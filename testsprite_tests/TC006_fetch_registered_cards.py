import requests

BASE_URL = "http://localhost:5555"
HEADERS = {
    "Accept": "application/json"
}
TIMEOUT = 30

def test_fetch_registered_cards():
    url = f"{BASE_URL}/rest/v1/cartoes"
    try:
        response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"

    # Validate response content type
    content_type = response.headers.get("Content-Type", "")
    assert "application/json" in content_type, f"Unexpected Content-Type: {content_type}"

    try:
        cards = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Validate that the response is a list (array) of cards
    assert isinstance(cards, list), f"Expected list of cards, got {type(cards)}"

    # For each card, validate expected fields presence and types (minimal validation)
    expected_fields = {"id", "numero_cartao", "nome_titular", "validade", "bandeira", "status_pagamento", "parcelas"}

    for card in cards:
        assert isinstance(card, dict), f"Card item is not a dict: {card}"
        missing_fields = expected_fields - card.keys()
        assert not missing_fields, f"Card is missing expected fields: {missing_fields}"

        # Example field type checks
        assert isinstance(card["id"], int), "Card 'id' should be int"
        assert isinstance(card["numero_cartao"], str), "Card 'numero_cartao' should be str"
        assert isinstance(card["nome_titular"], str), "Card 'nome_titular' should be str"
        assert isinstance(card["validade"], str), "Card 'validade' should be str (date string)"
        assert isinstance(card["bandeira"], str), "Card 'bandeira' should be str"
        assert isinstance(card["status_pagamento"], str), "Card 'status_pagamento' should be str"
        assert isinstance(card["parcelas"], int), "Card 'parcelas' should be int"

test_fetch_registered_cards()
