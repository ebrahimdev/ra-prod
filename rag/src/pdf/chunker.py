import re
from typing import List, Dict, Any, Tuple
from ..utils.logger import setup_logger
from ..llm.client import OpenChatClient

logger = setup_logger(__name__)

class DocumentChunker:
    def __init__(self, chunk_size: int = 512, overlap: int = 50, min_chunk_size: int = 100):
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.min_chunk_size = min_chunk_size  # Prevent micro-chunks
        self.llm_client = OpenChatClient()
        
        # Target distribution for balanced chunking
        self.target_distribution = {
            'text': 0.70,      # 70% text chunks (main content)
            'table': 0.20,     # 20% table chunks
            'reference': 0.10  # 10% reference chunks
        }
        
        # Citation patterns
        self.citation_patterns = [
            r'\[(\d+(?:,\s*\d+)*)\]',  # [1], [1,2,3]
            r'\(([A-Za-z]+(?:\s+et\s+al\.?)?,?\s*\d{4}(?:;\s*[A-Za-z]+(?:\s+et\s+al\.?)?,?\s*\d{4})*)\)',  # (Author, 2021)
            r'([A-Za-z]+(?:\s+et\s+al\.?)?\s+\(\d{4}\))',  # Author (2021)
        ]
        
        # Formula indicators
        self.formula_indicators = [
            r'equation\s+\(\d+\)',
            r'formula\s+\(\d+\)',
            r'eq\.\s*\(\d+\)',
            r'\\begin\{equation\}',
            r'\\begin\{align\}',
            r'\$.*?\$',
            r'\$\$.*?\$\$'
        ]
    
    def chunk_document(self, extracted_content: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Create semantic chunks from extracted PDF content using efficient batching."""
        logger.info("Starting optimized document chunking process")
        
        chunks = []
        text_content = extracted_content['text_content']
        structure = extracted_content['structure']
        tables = extracted_content.get('tables', [])
        
        # Step 1: Single document-level analysis (1 LLM call)
        document_analysis = self._analyze_document_structure(text_content, structure)
        
        # Step 2: Create semantic chunks using batched analysis
        section_chunks = self._create_semantic_chunks_optimized(
            text_content, structure, document_analysis
        )
        chunks.extend(section_chunks)
        
        # Step 3: Batch concept extraction for all text chunks (1-2 LLM calls)
        text_chunks = [chunk for chunk in chunks if chunk['chunk_type'] == 'text']
        if text_chunks:
            self._enhance_chunks_with_concepts_batch(text_chunks)
        
        # Step 4: Create table chunks (minimal LLM usage)
        table_chunks = self._create_table_chunks_optimized(tables)
        chunks.extend(table_chunks)
        
        # Step 5: Create reference chunks (no LLM needed)
        reference_chunks = self._create_reference_chunks(text_content, structure)
        chunks.extend(reference_chunks)
        
        # Sort chunks by page and position
        chunks.sort(key=lambda x: (x.get('page', 0), x.get('position', 0)))
        
        # Filter out micro-chunks and validate chunk sizes
        chunks = self._filter_and_validate_chunks(chunks)
        
        # Add chunk indices
        for i, chunk in enumerate(chunks):
            chunk['chunk_index'] = i
        
        # Log chunk distribution
        self._log_chunk_statistics(chunks)
        
        logger.info(f"Created {len(chunks)} optimized chunks from document")
        return chunks
    
    def _create_semantic_chunks(self, text_content: List[Dict], structure: Dict) -> List[Dict[str, Any]]:
        """Create chunks using LLM-guided semantic analysis."""
        chunks = []
        sections = structure.get('sections', [])
        
        if not sections:
            return self._create_page_chunks(text_content)
        
        for section in sections:
            section_title = section['title']
            start_idx = section['start_index']
            end_idx = section.get('end_index', len(text_content) - 1)
            
            # Collect all text blocks in this section
            section_blocks = text_content[start_idx:end_idx + 1]
            section_text = self._combine_text_blocks(section_blocks)
            
            try:
                # Use LLM to analyze content structure
                structure_analysis = self.llm_client.analyze_content_structure(section_text)
                boundaries = structure_analysis.get('boundaries', [])
                topics = structure_analysis.get('topics', [])
                section_type = structure_analysis.get('section_type', 'other')
                
                if boundaries and len(section_text) > self.chunk_size:
                    # Use LLM-identified boundaries for chunking
                    semantic_chunks = self._split_by_semantic_boundaries(
                        section_text, boundaries, section_title
                    )
                else:
                    # Use traditional chunking for smaller sections
                    semantic_chunks = [section_text] if len(section_text) <= self.chunk_size else self._split_long_text(section_text, section_title)
                
                # Extract research concepts for each chunk
                for i, chunk_text in enumerate(semantic_chunks):
                    concepts = self.llm_client.extract_research_concepts(chunk_text)
                    summary = self.llm_client.generate_chunk_summary(chunk_text)
                    
                    chunks.append({
                        'content': chunk_text,
                        'chunk_type': 'text',
                        'section_title': section_title,
                        'section_type': section_type,
                        'page_number': section['page'],
                        'sub_chunk_index': i,
                        'position': start_idx,
                        'metadata': {
                            'word_count': len(chunk_text.split()),
                            'has_citations': self._has_citations(chunk_text),
                            'has_formulas': self._has_formulas(chunk_text),
                            'topics': topics,
                            'research_concepts': concepts.get('concepts', []),
                            'methods': concepts.get('methods', []),
                            'keywords': concepts.get('keywords', []),
                            'research_area': concepts.get('research_area', 'unknown'),
                            'semantic_summary': summary
                        }
                    })
                    
            except Exception as e:
                logger.warning(f"LLM analysis failed for section '{section_title}': {e}")
                # Fallback to traditional chunking
                fallback_chunks = self._create_traditional_section_chunk(
                    section_text, section_title, section, start_idx
                )
                chunks.extend(fallback_chunks)
        
        return chunks
    
    def _split_by_semantic_boundaries(self, text: str, boundaries: List[int], section_title: str) -> List[str]:
        """Split text using LLM-identified semantic boundaries."""
        if not boundaries:
            return [text]
        
        chunks = []
        boundaries = sorted([b for b in boundaries if 0 <= b < len(text)])
        boundaries = [0] + boundaries + [len(text)]
        
        for i in range(len(boundaries) - 1):
            start = boundaries[i]
            end = boundaries[i + 1]
            chunk_text = text[start:end].strip()
            
            if chunk_text and len(chunk_text) > 50:  # Minimum chunk size
                chunks.append(chunk_text)
        
        return chunks if chunks else [text]
    
    def _create_traditional_section_chunk(self, section_text: str, section_title: str, section: Dict, start_idx: int) -> List[Dict[str, Any]]:
        """Fallback to traditional chunking for a section."""
        chunks = []
        
        if len(section_text) > self.chunk_size:
            sub_chunks = self._split_long_text(section_text, section_title)
            for i, sub_chunk in enumerate(sub_chunks):
                chunks.append({
                    'content': sub_chunk,
                    'chunk_type': 'text',
                    'section_title': section_title,
                    'section_type': section.get('type', 'other'),
                    'page_number': section['page'],
                    'sub_chunk_index': i,
                    'position': start_idx,
                    'metadata': {
                        'word_count': len(sub_chunk.split()),
                        'has_citations': self._has_citations(sub_chunk),
                        'has_formulas': self._has_formulas(sub_chunk),
                        'topics': [],
                        'research_concepts': [],
                        'methods': [],
                        'keywords': [],
                        'research_area': 'unknown',
                        'semantic_summary': ''
                    }
                })
        else:
            chunks.append({
                'content': section_text,
                'chunk_type': 'text',
                'section_title': section_title,
                'section_type': section.get('type', 'other'),
                'page_number': section['page'],
                'position': start_idx,
                'metadata': {
                    'word_count': len(section_text.split()),
                    'has_citations': self._has_citations(section_text),
                    'has_formulas': self._has_formulas(section_text),
                    'topics': [],
                    'research_concepts': [],
                    'methods': [],
                    'keywords': [],
                    'research_area': 'unknown',
                    'semantic_summary': ''
                }
            })
        
        return chunks
    
    def _create_page_chunks(self, text_content: List[Dict]) -> List[Dict[str, Any]]:
        """Fallback chunking by pages when no sections detected."""
        chunks = []
        
        # Group text blocks by page
        pages = {}
        for block in text_content:
            page_num = block.get('page', 1)
            if page_num not in pages:
                pages[page_num] = []
            pages[page_num].append(block)
        
        for page_num, blocks in pages.items():
            page_text = self._combine_text_blocks(blocks)
            
            if len(page_text) > self.chunk_size:
                sub_chunks = self._split_long_text(page_text, f"Page {page_num}")
                for i, sub_chunk in enumerate(sub_chunks):
                    chunks.append({
                        'content': sub_chunk,
                        'chunk_type': 'text',
                        'section_title': f"Page {page_num}",
                        'section_type': 'page',
                        'page_number': page_num,
                        'sub_chunk_index': i,
                        'position': 0,
                        'metadata': {
                            'word_count': len(sub_chunk.split()),
                            'has_citations': self._has_citations(sub_chunk),
                            'has_formulas': self._has_formulas(sub_chunk)
                        }
                    })
            else:
                chunks.append({
                    'content': page_text,
                    'chunk_type': 'text',
                    'section_title': f"Page {page_num}",
                    'section_type': 'page',
                    'page_number': page_num,
                    'position': 0,
                    'metadata': {
                        'word_count': len(page_text.split()),
                        'has_citations': self._has_citations(page_text),
                        'has_formulas': self._has_formulas(page_text)
                    }
                })
        
        return chunks
    
    
    def _create_table_chunks(self, tables: List[Dict]) -> List[Dict[str, Any]]:
        """Create enhanced chunks for tables with LLM analysis."""
        chunks = []
        
        for i, table in enumerate(tables):
            table_text = self._table_to_text(table['data'])
            full_content = f"[TABLE] {table_text}"
            
            # Try to extract concepts from table content
            concepts = {}
            if table_text:
                try:
                    concepts = self.llm_client.extract_research_concepts(table_text)
                except Exception as e:
                    logger.warning(f"Failed to analyze table content: {e}")
            
            chunks.append({
                'content': full_content,
                'chunk_type': 'table',
                'section_title': f"Table {i+1}",
                'section_type': 'table',
                'page_number': table['page'],
                'position': i,
                'metadata': {
                    'table_index': i,
                    'rows': table['rows'],
                    'cols': table['cols'],
                    'bbox': table.get('bbox', []),
                    'research_concepts': concepts.get('concepts', []),
                    'keywords': concepts.get('keywords', []),
                    'research_area': concepts.get('research_area', 'unknown')
                },
                'table_data': table['data']
            })
        
        return chunks
    
    def _create_reference_chunks(self, text_content: List[Dict], structure: Dict) -> List[Dict[str, Any]]:
        """Create optimized chunks for references - group instead of splitting individually."""
        chunks = []
        references_start = structure.get('references_start', -1)
        
        if references_start >= 0:
            # Extract reference section
            ref_blocks = text_content[references_start:]
            ref_text = self._combine_text_blocks(ref_blocks)
            
            # Group references into larger chunks instead of individual citations
            if len(ref_text) > self.chunk_size * 2:  # If references are long, create multiple chunks
                ref_chunks = self._split_long_text(ref_text, "References")
                for i, ref_chunk in enumerate(ref_chunks):
                    chunks.append({
                        'content': ref_chunk,
                        'chunk_type': 'reference',
                        'section_title': 'References',
                        'section_type': 'references',
                        'page_number': text_content[references_start]['page'] if references_start < len(text_content) else 1,
                        'position': references_start + i,
                        'metadata': {
                            'reference_group': i,
                            'is_citation_group': True,
                            'word_count': len(ref_chunk.split())
                        }
                    })
            else:
                # Single reference chunk for smaller reference sections
                chunks.append({
                    'content': ref_text,
                    'chunk_type': 'reference',
                    'section_title': 'References',
                    'section_type': 'references',
                    'page_number': text_content[references_start]['page'] if references_start < len(text_content) else 1,
                    'position': references_start,
                    'metadata': {
                        'reference_group': 0,
                        'is_citation_group': True,
                        'word_count': len(ref_text.split())
                    }
                })
        
        return chunks
    
    def _combine_text_blocks(self, blocks: List[Dict]) -> str:
        """Combine multiple text blocks into a single string."""
        return ' '.join([block['text'] for block in blocks if block.get('text')])
    
    def _split_long_text(self, text: str, section_title: str) -> List[str]:
        """Split long text into smaller chunks with overlap."""
        sentences = re.split(r'[.!?]+', text)
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            # Check if adding this sentence would exceed chunk size
            if len(current_chunk) + len(sentence) > self.chunk_size:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    
                    # Start new chunk with overlap
                    overlap_sentences = current_chunk.split('.')[-self.overlap//50:]  # Rough overlap
                    current_chunk = '. '.join(overlap_sentences) + ". " + sentence
                else:
                    current_chunk = sentence
            else:
                current_chunk += ". " + sentence if current_chunk else sentence
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def _has_citations(self, text: str) -> bool:
        """Check if text contains citations."""
        for pattern in self.citation_patterns:
            if re.search(pattern, text):
                return True
        return False
    
    def _has_formulas(self, text: str) -> bool:
        """Check if text contains mathematical formulas."""
        for pattern in self.formula_indicators:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False
    
    def _table_to_text(self, table_data: List[List[str]]) -> str:
        """Convert table data to text representation."""
        if not table_data:
            return ""
        
        text_rows = []
        for row in table_data:
            if row:
                text_rows.append(" | ".join([str(cell) if cell else "" for cell in row]))
        
        return "\n".join(text_rows)
    
    def _split_references(self, ref_text: str) -> List[str]:
        """Split reference text into individual references."""
        # Common reference patterns
        patterns = [
            r'\n\[\d+\]',  # [1] numbered references
            r'\n\d+\.',   # 1. numbered references
            r'\n[A-Z][a-z]+,',  # Author, Year format
        ]
        
        for pattern in patterns:
            refs = re.split(pattern, ref_text)
            if len(refs) > 1:
                return refs
        
        # Fallback: split by double newlines
        return ref_text.split('\n\n')
    
    def _analyze_document_structure(self, text_content: List[Dict], structure: Dict) -> Dict[str, Any]:
        """Analyze entire document structure in one LLM call."""
        try:
            # Prepare section data for batch analysis
            sections = []
            for section in structure.get('sections', []):
                start_idx = section['start_index']
                end_idx = section.get('end_index', len(text_content) - 1)
                section_blocks = text_content[start_idx:end_idx + 1]
                section_text = self._combine_text_blocks(section_blocks)
                
                sections.append({
                    'title': section['title'],
                    'text': section_text
                })
            
            # Single LLM call for entire document analysis
            if sections:
                return self.llm_client.analyze_document_structure_batch(sections)
            else:
                return {
                    "document_type": "research_paper",
                    "sections": [],
                    "overall_themes": [],
                    "research_area": "unknown",
                    "suggested_chunk_strategy": "paragraph"
                }
                
        except Exception as e:
            logger.warning(f"Document structure analysis failed: {e}")
            return {
                "document_type": "research_paper",
                "sections": [],
                "overall_themes": [],
                "research_area": "unknown",
                "suggested_chunk_strategy": "paragraph"
            }
    
    def _create_semantic_chunks_optimized(
        self, 
        text_content: List[Dict], 
        structure: Dict, 
        document_analysis: Dict
    ) -> List[Dict[str, Any]]:
        """Create semantic chunks using pre-analyzed document structure."""
        chunks = []
        sections = structure.get('sections', [])
        analyzed_sections = document_analysis.get('sections', [])
        
        if not sections:
            return self._create_page_chunks(text_content)
        
        for i, section in enumerate(sections):
            section_title = section['title']
            start_idx = section['start_index']
            end_idx = section.get('end_index', len(text_content) - 1)
            
            # Get analyzed data for this section
            section_analysis = {}
            if i < len(analyzed_sections):
                section_analysis = analyzed_sections[i]
            
            # Collect section text
            section_blocks = text_content[start_idx:end_idx + 1]
            section_text = self._combine_text_blocks(section_blocks)
            
            # Use pre-analyzed boundaries or fall back to traditional chunking
            boundaries = section_analysis.get('semantic_boundaries', [])
            section_type = section_analysis.get('type', 'other')
            topics = section_analysis.get('topics', [])
            
            if boundaries and len(section_text) > self.chunk_size:
                semantic_chunks = self._split_by_semantic_boundaries(
                    section_text, boundaries, section_title
                )
            else:
                semantic_chunks = [section_text] if len(section_text) <= self.chunk_size else self._split_long_text(section_text, section_title)
            
            # Create chunk objects (without individual LLM calls)
            for j, chunk_text in enumerate(semantic_chunks):
                chunks.append({
                    'content': chunk_text,
                    'chunk_type': 'text',
                    'section_title': section_title,
                    'section_type': section_type,
                    'page_number': section['page'],
                    'sub_chunk_index': j,
                    'position': start_idx,
                    'metadata': {
                        'word_count': len(chunk_text.split()),
                        'has_citations': self._has_citations(chunk_text),
                        'has_formulas': self._has_formulas(chunk_text),
                        'topics': topics,
                        'research_concepts': [],  # Will be filled by batch processing
                        'methods': [],  # Will be filled by batch processing
                        'keywords': [],  # Will be filled by batch processing
                        'research_area': document_analysis.get('research_area', 'unknown'),
                        'semantic_summary': ''  # Will be filled by batch processing
                    }
                })
        
        return chunks
    
    def _enhance_chunks_with_concepts_batch(self, chunks: List[Dict[str, Any]]) -> None:
        """Enhance chunks with research concepts using batch LLM processing."""
        try:
            # Extract text content from chunks
            chunk_texts = [chunk['content'] for chunk in chunks]
            
            # Batch concept extraction (1-2 LLM calls total)
            concepts_results = self.llm_client.extract_concepts_batch(chunk_texts)
            
            # Apply results to chunks
            for i, chunk in enumerate(chunks):
                if i < len(concepts_results):
                    concepts = concepts_results[i]
                    chunk['metadata']['research_concepts'] = concepts.get('concepts', [])
                    chunk['metadata']['methods'] = concepts.get('methods', [])
                    chunk['metadata']['keywords'] = concepts.get('keywords', [])
                    if concepts.get('research_area') != 'unknown':
                        chunk['metadata']['research_area'] = concepts.get('research_area')
                        
        except Exception as e:
            logger.warning(f"Batch concept extraction failed: {e}")
            # Chunks already have empty concept fields as fallback
    
    def _create_table_chunks_optimized(self, tables: List[Dict]) -> List[Dict[str, Any]]:
        """Create table chunks with minimal LLM usage."""
        chunks = []
        
        # Collect all table texts for potential batch processing
        table_texts = []
        for table in tables:
            table_text = self._table_to_text(table['data'])
            table_texts.append(table_text)
        
        # Only use LLM for tables with substantial content
        concepts_results = []
        substantial_tables = [text for text in table_texts if len(text) > 100]
        
        if substantial_tables:
            try:
                concepts_results = self.llm_client.extract_concepts_batch(substantial_tables)
            except Exception as e:
                logger.warning(f"Table concept extraction failed: {e}")
                concepts_results = []
        
        # Create table chunks
        concepts_idx = 0
        for i, table in enumerate(tables):
            table_text = table_texts[i]
            full_content = f"[TABLE] {table_text}"
            
            # Use concepts if available
            concepts = {}
            if len(table_text) > 100 and concepts_idx < len(concepts_results):
                concepts = concepts_results[concepts_idx]
                concepts_idx += 1
            
            chunks.append({
                'content': full_content,
                'chunk_type': 'table',
                'section_title': f"Table {i+1}",
                'section_type': 'table',
                'page_number': table['page'],
                'position': i,
                'metadata': {
                    'table_index': i,
                    'rows': table['rows'],
                    'cols': table['cols'],
                    'bbox': table.get('bbox', []),
                    'research_concepts': concepts.get('concepts', []),
                    'keywords': concepts.get('keywords', []),
                    'research_area': concepts.get('research_area', 'unknown')
                },
                'table_data': table['data']
            })
        
        return chunks    
    def _filter_and_validate_chunks(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Filter out micro-chunks and validate chunk quality."""
        filtered_chunks = []
        
        for chunk in chunks:
            content = chunk.get("content", "")
            word_count = len(content.split()) if content else 0
            
            # Skip micro-chunks (too small to be useful)
            if word_count < self.min_chunk_size // 10:  # ~10 words minimum
                logger.debug(f"Skipping micro-chunk with {word_count} words")
                continue
            
            # Skip chunks that are just whitespace or special characters
            if not content.strip() or len(content.strip()) < 20:
                continue
            
            # Merge small reference chunks with adjacent ones
            if (chunk.get("chunk_type") == "reference" and 
                word_count < self.min_chunk_size // 5 and 
                filtered_chunks and 
                filtered_chunks[-1].get("chunk_type") == "reference"):
                
                # Merge with previous reference chunk
                prev_chunk = filtered_chunks[-1]
                prev_chunk["content"] += "\n" + content
                prev_chunk["metadata"]["word_count"] = len(prev_chunk["content"].split())
                continue
            
            filtered_chunks.append(chunk)
        
        return filtered_chunks
    
    def _log_chunk_statistics(self, chunks: List[Dict[str, Any]]) -> None:
        """Log chunk distribution statistics."""
        if not chunks:
            return
        
        # Count by type
        type_counts = {}
        total_words = 0
        
        for chunk in chunks:
            chunk_type = chunk.get("chunk_type", "unknown")
            type_counts[chunk_type] = type_counts.get(chunk_type, 0) + 1
            
            content = chunk.get("content", "")
            total_words += len(content.split())
        
        total_chunks = len(chunks)
        
        logger.info("Chunk distribution:")
        for chunk_type, count in type_counts.items():
            percentage = (count / total_chunks) * 100
            logger.info(f"  {chunk_type}: {count} chunks ({percentage:.1f}%)")
        
        logger.info(f"Total words: {total_words}, Average words per chunk: {total_words/total_chunks:.1f}")
        
        # Check if distribution is balanced
        text_ratio = type_counts.get("text", 0) / total_chunks
        ref_ratio = type_counts.get("reference", 0) / total_chunks
        
        if ref_ratio > 0.5:
            logger.warning(f"High reference chunk ratio: {ref_ratio:.1%} (target: 10%)")
        if text_ratio < 0.5:
            logger.warning(f"Low text chunk ratio: {text_ratio:.1%} (target: 70%)")

