"""app/mailer.py: what goes to Postmark, and that a failed email never raises. The network call is replaced, so nothing is sent."""
import io
import json
import logging
import urllib.error

import pytest

from app import config, mailer


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


@pytest.fixture()
def sent(monkeypatch):
    """Turns sending on with a fake token and records each request instead of calling Postmark."""
    monkeypatch.setattr(config, "POSTMARK_TOKEN", "test-token")
    monkeypatch.setattr(config, "EMAIL_FROM", "office@waprep.org")
    calls = []

    def fake_urlopen(request, timeout):
        calls.append(request)
        return FakeResponse(b'{"ErrorCode":0,"Message":"OK"}')

    monkeypatch.setattr(mailer.urllib.request, "urlopen", fake_urlopen)
    return calls


def message(**kw):
    return mailer.render("maya@waprep.org", "Booked", "You're booked", ["Ms. Rivera, Tuesday 12:10."],
                        button=("Open Office Hours", "http://localhost:5173/student"), tag="booking", **kw)


def test_posts_the_email_to_postmark(sent):
    assert mailer.send_email(message()) is True
    request = sent[0]
    assert request.full_url == "https://api.postmarkapp.com/email"
    assert request.get_header("X-postmark-server-token") == "test-token"
    body = json.loads(request.data)
    assert body["From"] == "Washington Prep Office Hours <office@waprep.org>"
    assert body["To"] == "maya@waprep.org"
    assert body["Subject"] == "Booked"
    assert body["MessageStream"] == "outbound" and body["Tag"] == "booking"
    assert "Ms. Rivera, Tuesday 12:10." in body["TextBody"]
    assert "http://localhost:5173/student" in body["TextBody"]
    assert 'href="http://localhost:5173/student"' in body["HtmlBody"]


def test_without_a_token_the_email_is_logged_not_sent(monkeypatch, caplog):
    monkeypatch.setattr(config, "POSTMARK_TOKEN", "")
    monkeypatch.setattr(mailer.urllib.request, "urlopen", lambda *a, **k: pytest.fail("must not call Postmark"))
    with caplog.at_level(logging.INFO, logger="office_hours.email"):
        assert mailer.send_email(message()) is True
    assert "maya@waprep.org" in caplog.text and "You're booked" in caplog.text


def test_text_is_escaped_in_the_html_version():
    m = mailer.render("a@waprep.org", "s", "<b>Hi</b>", ["Tom & Jerry <script>"])
    assert "<script>" not in m.html and "Tom &amp; Jerry &lt;script&gt;" in m.html
    assert "Tom & Jerry <script>" in m.text


def test_a_refused_email_returns_false_and_logs_why(sent, monkeypatch, caplog):
    def refuse(request, timeout):
        raise urllib.error.HTTPError(request.full_url, 422, "Unprocessable", {},
                                     io.BytesIO(b'{"ErrorCode":300,"Message":"Invalid email request"}'))

    monkeypatch.setattr(mailer.urllib.request, "urlopen", refuse)
    with caplog.at_level(logging.ERROR, logger="office_hours.email"):
        assert mailer.send_email(message()) is False
    assert "Invalid email request" in caplog.text


def test_postmark_unreachable_returns_false(sent, monkeypatch):
    def down(request, timeout):
        raise urllib.error.URLError("timed out")

    monkeypatch.setattr(mailer.urllib.request, "urlopen", down)
    assert mailer.send_email(message()) is False


def test_no_address_or_no_sender_is_not_sent(sent, monkeypatch):
    assert mailer.send_email(mailer.render("", "s", "h", [])) is False
    monkeypatch.setattr(config, "EMAIL_FROM", "")
    assert mailer.send_email(message()) is False
    assert sent == []


def test_many_emails_go_in_one_batch_call(sent, monkeypatch, caplog):
    def answer(request, timeout):
        sent.append(request)
        return FakeResponse(json.dumps([{"ErrorCode": 0}, {"ErrorCode": 406, "Message": "Inactive recipient"}]).encode())

    monkeypatch.setattr(mailer.urllib.request, "urlopen", answer)
    a = mailer.render("a@waprep.org", "One", "h", ["x"])
    b = mailer.render("b@waprep.org", "Two", "h", ["y"])
    with caplog.at_level(logging.ERROR, logger="office_hours.email"):
        assert mailer.send_many([a, b]) == 1
    assert len(sent) == 1 and sent[0].full_url == "https://api.postmarkapp.com/email/batch"
    assert [m["To"] for m in json.loads(sent[0].data)] == ["a@waprep.org", "b@waprep.org"]
    assert "b@waprep.org: Inactive recipient" in caplog.text


def test_demo_addresses_at_example_com_are_never_emailed(sent):
    demo = mailer.render("maya@example.com", "s", "h", ["x"])
    assert mailer.send_email(demo) is False
    assert mailer.send_many([demo]) == 0
    assert sent == []
