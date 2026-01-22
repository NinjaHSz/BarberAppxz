import requests

BASE_URL = "http://localhost:5555"
TIMEOUT = 30
HEADERS = {
    "Accept": "application/json"
}

def test_fetch_payment_history_for_plans():
    url = f"{BASE_URL}/rest/v1/pagamentos_planos"
    try:
        response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not a valid JSON"

    assert isinstance(data, list), "Response JSON should be a list of payment history records"

    for record in data:
        assert isinstance(record, dict), "Each payment record should be a dictionary"
        assert "id" in record, "Payment record missing 'id' field"
        assert "client_id" in record or "cliente_id" in record, "Payment record missing client identifier"
        assert "plan_id" in record or "plano_id" in record, "Payment record missing plan identifier"
        assert "payment_date" in record or "data_pagamento" in record, "Payment record missing payment date"
        assert "amount" in record or "valor" in record, "Payment record missing amount/payment value"


test_fetch_payment_history_for_plans()