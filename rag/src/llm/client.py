"""
LLM client for OpenChat integration
"""
import json
import logging
import requests
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class LLMResponse:
    content: str
    usage: Dict[str, int]
    model: str

class OpenChatClient:
    def __init__(self, base_url: str = "http://100.115.151.29:8080"):
        self.base_url = base_url
        self.headers = {"Content-Type": "application/json"}
    
    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "openchat",
        max_tokens: int = 500,
        temperature: float = 0.1
    ) -> LLMResponse:
        """Send chat completion request to OpenChat server"""
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/v1/chat/completions",
                headers=self.headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            
            data = response.json()
            return LLMResponse(
                content=data["choices"][0]["message"]["content"].strip(),
                usage=data.get("usage", {}),
                model=data.get("model", model)
            )
            
        except requests.exceptions.RequestException as e:
            logger.error(f"LLM request failed: {e}")
            raise Exception(f"LLM service unavailable: {e}")
        except (KeyError, IndexError) as e:
            logger.error(f"Invalid LLM response format: {e}")
            raise Exception(f"Invalid LLM response: {e}")
    
    def analyze_content_structure(self, text: str) -> Dict[str, Any]:
        """Analyze text structure for semantic chunking"""
        messages = [
            {
                "role": "system",
                "content": "You are a research paper analysis assistant. Analyze the given text and identify logical semantic boundaries for chunking. Return only valid JSON."
            },
            {
                "role": "user",
                "content": f"""Analyze this research paper text and identify semantic boundaries for chunking:

{text[:2000]}...

Return JSON with:
{{
    "boundaries": [list of character positions where semantic breaks occur],
    "topics": [list of main topics/concepts in this text],
    "section_type": "abstract|introduction|methodology|results|discussion|conclusion|references|other"
}}"""
            }
        ]
        
        try:
            response = self.chat_completion(messages, max_tokens=300)
            return json.loads(response.content)
        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"Failed to analyze structure: {e}")
            return {"boundaries": [], "topics": [], "section_type": "other"}
    
    def extract_research_concepts(self, text: str) -> Dict[str, Any]:
        """Extract research concepts and themes from text"""
        messages = [
            {
                "role": "system", 
                "content": "Extract key research concepts from academic text. Return only valid JSON."
            },
            {
                "role": "user",
                "content": f"""Extract key research concepts from this academic text:

{text[:1500]}

Return JSON with:
{{
    "concepts": [list of main research concepts/terms],
    "methods": [list of methodologies mentioned],
    "keywords": [list of academic keywords],
    "research_area": "primary research domain"
}}"""
            }
        ]
        
        try:
            response = self.chat_completion(messages, max_tokens=200)
            return json.loads(response.content)
        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"Failed to extract concepts: {e}")
            return {"concepts": [], "methods": [], "keywords": [], "research_area": "unknown"}
    
    def generate_chunk_summary(self, text: str) -> str:
        """Generate a concise summary for a text chunk"""
        messages = [
            {
                "role": "system",
                "content": "Summarize academic text in 1-2 sentences focusing on key contributions and findings."
            },
            {
                "role": "user", 
                "content": f"Summarize this academic text concisely:\n\n{text[:1000]}"
            }
        ]
        
        try:
            response = self.chat_completion(messages, max_tokens=100)
            return response.content
        except Exception as e:
            logger.warning(f"Failed to generate summary: {e}")
            return ""
    
    def analyze_document_structure_batch(self, sections: List[Dict[str, str]]) -> Dict[str, Any]:
        """Analyze entire document structure in one call, respecting token limits"""
        # Build document overview for analysis
        doc_sections = []
        total_tokens = 0
        
        for section in sections:
            title = section.get('title', 'Untitled')
            text = section.get('text', '')
            
            # Estimate tokens (rough: 1 token ≈ 4 characters)
            section_preview = text[:500]  # First 500 chars per section
            section_tokens = len(section_preview) // 4
            
            if total_tokens + section_tokens < 6000:  # Leave room for prompt
                doc_sections.append(f"Section: {title}\n{section_preview}")
                total_tokens += section_tokens
            else:
                break
        
        document_text = "\n\n".join(doc_sections)
        
        messages = [
            {
                "role": "system",
                "content": "You are a research paper structure analyzer. Analyze the document and provide comprehensive structure analysis. Return only valid JSON."
            },
            {
                "role": "user",
                "content": f"""Analyze this research paper's structure and provide semantic chunking guidance:

{document_text}

Return JSON with:
{{
    "document_type": "research_paper|survey|technical_report|other",
    "sections": [
        {{
            "title": "section title",
            "type": "abstract|introduction|methodology|results|discussion|conclusion|references|other",
            "topics": ["key topics in this section"],
            "semantic_boundaries": [estimated character positions for chunk boundaries],
            "complexity": "high|medium|low"
        }}
    ],
    "overall_themes": ["main research themes"],
    "research_area": "primary research domain",
    "suggested_chunk_strategy": "semantic|paragraph|hybrid"
}}"""
            }
        ]
        
        try:
            response = self.chat_completion(messages, max_tokens=800)
            return json.loads(response.content)
        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"Failed to analyze document structure: {e}")
            return {
                "document_type": "research_paper",
                "sections": [],
                "overall_themes": [],
                "research_area": "unknown",
                "suggested_chunk_strategy": "paragraph"
            }
    
    def extract_concepts_batch(self, chunk_texts: List[str]) -> List[Dict[str, Any]]:
        """Extract concepts from multiple chunks in batches, respecting token limits"""
        results = []
        batch_size = 0
        current_batch = []
        
        for i, text in enumerate(chunk_texts):
            # Estimate tokens for this chunk (truncate if needed)
            chunk_preview = text[:300]  # Limit each chunk to 300 chars
            chunk_tokens = len(chunk_preview) // 4
            
            # Check if adding this chunk would exceed token limit
            if batch_size + chunk_tokens > 5000:  # Process current batch
                if current_batch:
                    batch_results = self._process_concept_batch(current_batch)
                    results.extend(batch_results)
                
                # Start new batch
                current_batch = [(i, chunk_preview)]
                batch_size = chunk_tokens
            else:
                current_batch.append((i, chunk_preview))
                batch_size += chunk_tokens
        
        # Process final batch
        if current_batch:
            batch_results = self._process_concept_batch(current_batch)
            results.extend(batch_results)
        
        # Sort results by original index to maintain order
        results.sort(key=lambda x: x[0])
        return [result[1] for result in results]
    
    def _process_concept_batch(self, batch: List[tuple]) -> List[tuple]:
        """Process a batch of chunks for concept extraction"""
        if not batch:
            return []
        
        # Build batch prompt
        batch_text = ""
        for idx, text in batch:
            batch_text += f"\n--- Chunk {idx} ---\n{text}\n"
        
        messages = [
            {
                "role": "system",
                "content": "Extract research concepts from multiple academic text chunks. Return JSON array with one object per chunk."
            },
            {
                "role": "user",
                "content": f"""Extract key research concepts from these academic text chunks:

{batch_text}

Return JSON array with one object per chunk:
[
    {{
        "concepts": ["research concepts for chunk 0"],
        "methods": ["methodologies mentioned"],
        "keywords": ["academic keywords"],
        "research_area": "research domain"
    }},
    ... (one object for each chunk)
]"""
            }
        ]
        
        try:
            response = self.chat_completion(messages, max_tokens=600)
            parsed_results = json.loads(response.content)
            
            # Return results with original indices
            results = []
            for i, (original_idx, _) in enumerate(batch):
                if i < len(parsed_results):
                    results.append((original_idx, parsed_results[i]))
                else:
                    # Fallback for missing results
                    results.append((original_idx, {
                        "concepts": [], "methods": [], "keywords": [], "research_area": "unknown"
                    }))
            
            return results
            
        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"Failed to extract concepts batch: {e}")
            # Return empty results for all chunks in batch
            return [(idx, {"concepts": [], "methods": [], "keywords": [], "research_area": "unknown"}) 
                   for idx, _ in batch]

    def estimate_tokens(self, text: str) -> int:
        """Rough token estimation (1 token ≈ 4 characters for English)"""
        return len(text) // 4