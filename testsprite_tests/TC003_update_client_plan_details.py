import requests
import uuid

BASE_URL = 'http://localhost:5555'
CLIENTS_ENDPOINT = f"{BASE_URL}/rest/v1/clientes"
HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
}
TIMEOUT = 30

def test_update_client_plan_details():
    # Assume a client ID to update (must exist in DB for test to pass)
    existing_client_id = 'existing-client-id-to-update'

    # Prepare update payload: update subscription plan details
    update_payload = {
        "plano_assinatura": "anual",
        "status_pagamento": "inativo"
    }
    # Perform PATCH request to update client plan details by specifying id in query param
    patch_response = requests.patch(CLIENTS_ENDPOINT, json=update_payload, headers=HEADERS, timeout=TIMEOUT, params={"id": f"eq.{existing_client_id}"})
    assert patch_response.status_code in (200, 204), f"Failed to update client plan: {patch_response.text}"

    # Validate changes persisted by fetching the client data
    params = {
        "id": f"eq.{existing_client_id}"
    }
    get_response = requests.get(CLIENTS_ENDPOINT, headers=HEADERS, params=params, timeout=TIMEOUT)
    assert get_response.status_code == 200, f"Failed to fetch updated client data: {get_response.text}"
    clients = get_response.json()
    assert isinstance(clients, list) and len(clients) == 1, "Updated client not found or multiple entries returned"
    client = clients[0]
    assert client["id"] == existing_client_id, "Client ID mismatch"
    assert client["plano_assinatura"] == "anual", f"Subscription plan not updated, expected 'anual' got {client['plano_assinatura']}"
    assert client["status_pagamento"] == "inativo", f"Payment status not updated, expected 'inativo' got {client['status_pagamento']}"

    # Test validation of input data by sending invalid plan detail
    invalid_update_payload = {
        "plano_assinatura": 12345  # invalid type
    }
    invalid_response = requests.patch(CLIENTS_ENDPOINT, json=invalid_update_payload, headers=HEADERS, timeout=TIMEOUT, params={"id": f"eq.{existing_client_id}"})
    # Expecting error due to invalid data type
    assert invalid_response.status_code >= 400, "Invalid input was accepted, expected error status code"


test_update_client_plan_details()
