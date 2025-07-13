import re
from typing import List, Dict, Any, Tuple
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

class DocumentChunker:
    def __init__(self, chunk_size: int = 512, overlap: int = 50):
        self.chunk_size = chunk_size
        self.overlap = overlap
        
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
        """Create semantic chunks from extracted PDF content."""
        logger.info("Starting document chunking process")
        
        chunks = []
        text_content = extracted_content['text_content']
        structure = extracted_content['structure']
        images = extracted_content['images']
        tables = extracted_content.get('tables', [])
        
        # Create section-based chunks
        section_chunks = self._create_section_chunks(text_content, structure)
        chunks.extend(section_chunks)
        
        # Create image chunks
        image_chunks = self._create_image_chunks(images)
        chunks.extend(image_chunks)
        
        # Create table chunks
        table_chunks = self._create_table_chunks(tables)
        chunks.extend(table_chunks)
        
        # Create cross-reference chunks for better context
        reference_chunks = self._create_reference_chunks(text_content, structure)
        chunks.extend(reference_chunks)
        
        # Sort chunks by page and position
        chunks.sort(key=lambda x: (x.get('page', 0), x.get('position', 0)))
        
        # Add chunk indices
        for i, chunk in enumerate(chunks):
            chunk['chunk_index'] = i
        
        logger.info(f"Created {len(chunks)} chunks from document")
        return chunks
    
    def _create_section_chunks(self, text_content: List[Dict], structure: Dict) -> List[Dict[str, Any]]:
        """Create chunks based on document sections."""
        chunks = []
        sections = structure.get('sections', [])
        
        if not sections:
            # Fallback to page-based chunking if no sections detected
            return self._create_page_chunks(text_content)
        
        for section in sections:
            section_title = section['title']
            start_idx = section['start_index']
            end_idx = section.get('end_index', len(text_content) - 1)
            
            # Collect all text blocks in this section
            section_blocks = text_content[start_idx:end_idx + 1]
            section_text = self._combine_text_blocks(section_blocks)
            
            if len(section_text) > self.chunk_size:
                # Split large sections into smaller chunks
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
                            'has_formulas': self._has_formulas(sub_chunk)
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
                        'has_formulas': self._has_formulas(section_text)
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
    
    def _create_image_chunks(self, images: List[Dict]) -> List[Dict[str, Any]]:
        """Create chunks for images and figures."""
        chunks = []
        
        for i, image in enumerate(images):
            # Extract caption or description if available
            caption = image.get('caption', '')
            image_type = image.get('type', 'figure')
            
            content = f"[{image_type.upper()}] "
            if caption:
                content += caption
            else:
                content += f"Image on page {image['page']}"
            
            chunks.append({
                'content': content,
                'chunk_type': 'image',
                'section_title': f"Figure {i+1}",
                'section_type': 'figure',
                'page_number': image['page'],
                'position': i,
                'metadata': {
                    'image_index': i,
                    'image_type': image_type,
                    'image_size': image.get('size', []),
                    'bbox': image.get('bbox', []),
                    'has_ocr_text': bool(image.get('ocr_text', ''))
                },
                'image_data': {
                    'format': image.get('format', ''),
                    'data': image.get('data', ''),  # base64 encoded
                    'ocr_text': image.get('ocr_text', '')
                }
            })
        
        return chunks
    
    def _create_table_chunks(self, tables: List[Dict]) -> List[Dict[str, Any]]:
        """Create chunks for tables."""
        chunks = []
        
        for i, table in enumerate(tables):
            # Convert table data to text representation
            table_text = self._table_to_text(table['data'])
            
            chunks.append({
                'content': f"[TABLE] {table_text}",
                'chunk_type': 'table',
                'section_title': f"Table {i+1}",
                'section_type': 'table',
                'page_number': table['page'],
                'position': i,
                'metadata': {
                    'table_index': i,
                    'rows': table['rows'],
                    'cols': table['cols'],
                    'bbox': table.get('bbox', [])
                },
                'table_data': table['data']
            })
        
        return chunks
    
    def _create_reference_chunks(self, text_content: List[Dict], structure: Dict) -> List[Dict[str, Any]]:
        """Create chunks for references and citations."""
        chunks = []
        references_start = structure.get('references_start', -1)
        
        if references_start >= 0:
            # Extract reference section
            ref_blocks = text_content[references_start:]
            ref_text = self._combine_text_blocks(ref_blocks)
            
            # Split references by pattern (usually numbered or authored)
            references = self._split_references(ref_text)
            
            for i, ref in enumerate(references):
                if ref.strip():
                    chunks.append({
                        'content': ref.strip(),
                        'chunk_type': 'reference',
                        'section_title': 'References',
                        'section_type': 'references',
                        'page_number': text_content[references_start]['page'] if references_start < len(text_content) else 1,
                        'position': references_start + i,
                        'metadata': {
                            'reference_index': i,
                            'is_citation': True
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