from flask import current_app
import requests


def verify_turnstile_token(token: str, remote_ip: str | None = None) -> bool:
    if not current_app.config["TURNSTILE_ENABLED"]:
        return True
    if not token:
        return False

    try:
        resp = requests.post(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data={
                "secret": current_app.config["TURNSTILE_SECRET_KEY"],
                "response": token,
                "remoteip": remote_ip,
            },
            timeout=5,
        )
        return resp.json().get("success", False)
    except requests.RequestException:
        # fail-open: Cloudflare側の障害・タイムアウト時はログイン機能自体を止めない
        return True
