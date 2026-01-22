import requests

BASE_URL = "http://localhost:5555"
TIMEOUT = 30

def test_fetch_all_expenses():
    url = f"{BASE_URL}/rest/v1/saidas"
    headers = {
        "Accept": "application/json"
    }

    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request to fetch all expenses failed: {e}"

    try:
        expenses = response.json()
    except ValueError:
        assert False, "Response is not a valid JSON"

    assert isinstance(expenses, list), "Expenses response should be a list"

    for expense in expenses:
        # Validate presence and types of important fields for expenses
        assert isinstance(expense, dict), "Each expense record should be a dictionary"
        assert "id" in expense, "Expense record missing 'id'"
        assert isinstance(expense.get("id"), int), "'id' should be int"

        assert "descricao" in expense, "Expense record missing 'descricao' (description)"
        assert isinstance(expense.get("descricao"), str), "'descricao' should be string"

        assert "valor" in expense, "Expense record missing 'valor' (value)"
        assert isinstance(expense.get("valor"), (int, float)), "'valor' should be a number"

        assert "data_pagamento" in expense, "Expense record missing 'data_pagamento' (payment date)"
        # Could be None or string date
        assert (expense.get("data_pagamento") is None or isinstance(expense.get("data_pagamento"), str))

        assert "status_pagamento" in expense, "Expense record missing 'status_pagamento' (payment status)"
        assert isinstance(expense.get("status_pagamento"), str), "'status_pagamento' should be string"

        # Installment information if available
        if "parcelas" in expense:
            parcelas = expense.get("parcelas")
            assert (parcelas is None or isinstance(parcelas, int)), "'parcelas' should be an integer or null"

        if "parcela_atual" in expense:
            parcela_atual = expense.get("parcela_atual")
            assert (parcela_atual is None or isinstance(parcela_atual, int)), "'parcela_atual' should be an integer or null"

test_fetch_all_expenses()
