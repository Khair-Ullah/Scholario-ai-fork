CSRF_TEST_TOKEN = "test-csrf-token"


def apply_csrf(client) -> None:
    client.cookies.set("csrftoken", CSRF_TEST_TOKEN)
    client.headers.update({"X-CSRF-Token": CSRF_TEST_TOKEN})
    return CSRF_TEST_TOKEN


def reset_csrf(client) -> None:
    client.cookies.delete("csrftoken")
    client.headers.pop("X-CSRF-Token", None)

