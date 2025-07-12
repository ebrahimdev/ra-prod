class RagService:
    def __init__(self):
        pass
    
    def process_query(self, query: str, user_id: int) -> str:
        return f"User {user_id} processed: {query}"