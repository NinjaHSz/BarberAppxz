import requests

BASE_URL = r"http://localhost:5555/c:\Users\jluca\Downloads\My Apps\BarberApp"
TIMEOUT = 30

def test_sync_records_from_configured_url():
    # Example URL parameter to sync data from; in real test this should be a valid configured URL
    sync_url = "https://example.com/data-source-to-sync"

    try:
        # Call the /sync endpoint with the URL query parameter
        resp = requests.get(f"{BASE_URL}/sync", params={"url": sync_url}, timeout=TIMEOUT)
        resp.raise_for_status()
        sync_data = resp.json()

        # Validate response is a dict/object and contains expected keys
        assert isinstance(sync_data, dict), "Response should be a JSON object"

        # To confirm sync worked, check data was fetched and merged without loss or duplication:
        # 1. Fetch clients from Supabase via /rest/v1/clientes
        clients_resp = requests.get(f"{BASE_URL}/rest/v1/clientes", timeout=TIMEOUT)
        clients_resp.raise_for_status()
        clients = clients_resp.json()
        assert isinstance(clients, list), "Clients response should be a list"

        # 2. Fetch payment plans
        payments_resp = requests.get(f"{BASE_URL}/rest/v1/pagamentos_planos", timeout=TIMEOUT)
        payments_resp.raise_for_status()
        payments = payments_resp.json()
        assert isinstance(payments, list), "Payments response should be a list"

        # 3. Fetch expenses
        expenses_resp = requests.get(f"{BASE_URL}/rest/v1/saidas", timeout=TIMEOUT)
        expenses_resp.raise_for_status()
        expenses = expenses_resp.json()
        assert isinstance(expenses, list), "Expenses response should be a list"

        # 4. Fetch cards
        cards_resp = requests.get(f"{BASE_URL}/rest/v1/cartoes", timeout=TIMEOUT)
        cards_resp.raise_for_status()
        cards = cards_resp.json()
        assert isinstance(cards, list), "Cards response should be a list"

        # Basic validations related to the synchronization logic:
        # Ensure no duplicate client IDs after sync (checking uniqueness)
        client_ids = [c.get("id") for c in clients if "id" in c]
        assert len(client_ids) == len(set(client_ids)), "Duplicate client IDs found after sync"

        # Ensure payment records correspond to existing clients (if payments have client_id)
        payment_client_ids = [p.get("client_id") for p in payments if "client_id" in p]
        for pcid in payment_client_ids:
            assert pcid in client_ids, f"Payment with unknown client_id {pcid}"

        # Additional integrity checks can be added as needed based on PRD and app state

    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    except ValueError as e:
        assert False, f"Invalid JSON response: {e}"

test_sync_records_from_configured_url()