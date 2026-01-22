import requests

BASE_URL = "http://localhost:5555"
CLIENTS_ENDPOINT = "/rest/v1/clientes"
TIMEOUT = 30

def test_fetch_all_clients():
    url = f"{BASE_URL}{CLIENTS_ENDPOINT}"
    headers = {
        "Accept": "application/json"
    }

    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        clients = response.json()

        # Assert that the response is a list (array of clients)
        assert isinstance(clients, list), "Expected response to be a list of clients"

        # If there are clients, check that each client has expected keys
        if clients:
            expected_keys = {"id", "name", "email", "phone", "subscription_plan", "payment_history"}
            for client in clients:
                assert isinstance(client, dict), "Each client should be a dictionary"
                # Validate client keys exist (at least some keys expected in a client)
                assert expected_keys.intersection(client.keys()), "Client object missing expected keys"

    except requests.exceptions.HTTPError as http_err:
        assert False, f"HTTP error occurred: {http_err}"
    except requests.exceptions.RequestException as req_err:
        assert False, f"Request error occurred: {req_err}"
    except ValueError as json_err:
        assert False, f"JSON decode error: {json_err}"

test_fetch_all_clients()