import fitz  # PyMuPDF
import pdfplumber
import re
import json
from typing import List, Dict, Any, Tuple
from PIL import Image
import io
import base64
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

class PDFExtractor:
    def __init__(self):
        self.section_patterns = [
            # Abstract patterns
            r'^\s*abstract\s*$',
            r'^\s*summary\s*$',
            
            # Introduction patterns
            r'^\s*\d+\.?\s*introduction\s*$',
            r'^\s*introduction\s*$',
            r'^\s*\d+\.?\s*background\s*$',
            r'^\s*background\s*$',
            
            # Related work patterns
            r'^\s*\d+\.?\s*related\s+work\s*$',
            r'^\s*related\s+work\s*$',
            r'^\s*\d+\.?\s*literature\s+review\s*$',
            r'^\s*literature\s+review\s*$',
            
            # Methods patterns
            r'^\s*\d+\.?\s*methodology?\s*$',
            r'^\s*methodology?\s*$',
            r'^\s*\d+\.?\s*methods?\s*$',
            r'^\s*methods?\s*$',
            r'^\s*\d+\.?\s*approach\s*$',
            r'^\s*approach\s*$',
            r'^\s*\d+\.?\s*model\s*$',
            r'^\s*model\s*$',
            
            # Experiments and results patterns
            r'^\s*\d+\.?\s*experiments?\s*$',
            r'^\s*experiments?\s*$',
            r'^\s*\d+\.?\s*results?\s*$',
            r'^\s*results?\s*$',
            r'^\s*\d+\.?\s*evaluation\s*$',
            r'^\s*evaluation\s*$',
            r'^\s*\d+\.?\s*analysis\s*$',
            r'^\s*analysis\s*$',
            
            # Discussion patterns
            r'^\s*\d+\.?\s*discussion\s*$',
            r'^\s*discussion\s*$',
            r'^\s*\d+\.?\s*findings\s*$',
            r'^\s*findings\s*$',
            
            # Conclusion patterns
            r'^\s*\d+\.?\s*conclusions?\s*$',
            r'^\s*conclusions?\s*$',
            r'^\s*\d+\.?\s*future\s+work\s*$',
            r'^\s*future\s+work\s*$',
            
            # References patterns
            r'^\s*references?\s*$',
            r'^\s*bibliography\s*$',
            r'^\s*works?\s+cited\s*$',
            
            # Appendix patterns
            r'^\s*appendix\s*[a-z]?\s*$',
            r'^\s*[a-z]\.?\s*appendix\s*$',
            
            # Numbered sections (catch-all)
            r'^\s*\d+\.?\s+[a-z][a-z\s]+$'
        ]
    
    def extract_content(self, pdf_path: str) -> Dict[str, Any]:
        """Extract all content from PDF including text, images, and metadata."""
        logger.info(f"Starting PDF extraction for: {pdf_path}")
        
        result = {
            'text_content': [],
            'images': [],
            'metadata': {},
            'structure': {},
            'page_count': 0
        }
        
        try:
            # Extract text and structure with PyMuPDF
            fitz_doc = fitz.open(pdf_path)
            result['page_count'] = len(fitz_doc)
            result['metadata'] = self._extract_metadata(fitz_doc)
            
            # Extract text content page by page
            for page_num in range(len(fitz_doc)):
                page = fitz_doc[page_num]
                
                # Extract text with positioning
                text_dict = page.get_text("dict")
                page_content = self._process_page_text(text_dict, page_num + 1)
                result['text_content'].extend(page_content)
                
                # Extract images
                images = self._extract_images_from_page(page, page_num + 1)
                result['images'].extend(images)
            
            fitz_doc.close()
            
            # Extract tables with pdfplumber
            tables = self._extract_tables(pdf_path)
            result['tables'] = tables
            
            # Detect document structure
            result['structure'] = self._detect_structure(result['text_content'])
            
            logger.info(f"Extraction complete. Pages: {result['page_count']}, "
                       f"Text blocks: {len(result['text_content'])}, "
                       f"Images: {len(result['images'])}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error extracting PDF content: {str(e)}")
            raise
    
    def _extract_metadata(self, doc: fitz.Document) -> Dict[str, Any]:
        """Extract document metadata."""
        metadata = doc.metadata
        return {
            'title': metadata.get('title', ''),
            'author': metadata.get('author', ''),
            'subject': metadata.get('subject', ''),
            'creator': metadata.get('creator', ''),
            'producer': metadata.get('producer', ''),
            'creation_date': metadata.get('creationDate', ''),
            'modification_date': metadata.get('modDate', ''),
            'page_count': len(doc)
        }
    
    def _process_page_text(self, text_dict: Dict, page_num: int) -> List[Dict[str, Any]]:
        """Process text from a page and extract structured content."""
        text_blocks = []
        
        for block in text_dict.get("blocks", []):
            if block.get("type") == 0:  # Text block
                block_text = ""
                font_info = []
                
                for line in block.get("lines", []):
                    line_text = ""
                    for span in line.get("spans", []):
                        span_text = span.get("text", "")
                        line_text += span_text
                        
                        # Collect font information
                        font_info.append({
                            'text': span_text,
                            'font': span.get("font", ""),
                            'size': span.get("size", 0),
                            'flags': span.get("flags", 0),
                            'bbox': span.get("bbox", [])
                        })
                    
                    block_text += line_text + "\n"
                
                if block_text.strip():
                    text_blocks.append({
                        'text': block_text.strip(),
                        'page': page_num,
                        'bbox': block.get("bbox", []),
                        'type': self._classify_text_block(block_text, font_info),
                        'font_info': font_info
                    })
        
        return text_blocks
    
    def _classify_text_block(self, text: str, font_info: List[Dict]) -> str:
        """Classify text block type (title, heading, body, etc.)."""
        text_lower = text.lower().strip()
        
        # Check if it's a section heading
        for pattern in self.section_patterns:
            if re.match(pattern, text_lower, re.IGNORECASE):
                return 'section_heading'
        
        # Check font size for headings
        if font_info:
            avg_size = sum(f.get('size', 0) for f in font_info) / len(font_info)
            if avg_size > 14:
                return 'title'
            elif avg_size > 12:
                return 'heading'
        
        # Check for references
        if re.match(r'^\[\d+\]', text) or re.match(r'^\d+\.', text):
            return 'reference'
        
        # Check for formulas (contains mathematical symbols)
        if re.search(r'[∑∏∫∂∇αβγδεζηθικλμνξοπρστυφχψω]', text):
            return 'formula'
        
        return 'body'
    
    def _extract_images_from_page(self, page: fitz.Page, page_num: int) -> List[Dict[str, Any]]:
        """Extract images from a page."""
        images = []
        image_list = page.get_images()
        
        for img_index, img in enumerate(image_list):
            try:
                # Get image data
                xref = img[0]
                base_image = page.parent.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                
                # Convert to PIL Image for processing
                image = Image.open(io.BytesIO(image_bytes))
                
                # Get image position
                image_rects = page.get_image_rects(img)
                bbox = list(image_rects[0]) if image_rects else []
                
                images.append({
                    'page': page_num,
                    'index': img_index,
                    'bbox': bbox,
                    'format': image_ext,
                    'size': image.size,
                    'data': base64.b64encode(image_bytes).decode(),
                    'type': self._classify_image(image)
                })
                
            except Exception as e:
                logger.warning(f"Failed to extract image {img_index} from page {page_num}: {str(e)}")
        
        return images
    
    def _classify_image(self, image: Image.Image) -> str:
        """Classify image type based on characteristics."""
        width, height = image.size
        aspect_ratio = width / height
        
        # Simple heuristics for image classification
        if aspect_ratio > 2:
            return 'chart'
        elif 0.5 < aspect_ratio < 2:
            return 'figure'
        else:
            return 'diagram'
    
    def _extract_tables(self, pdf_path: str) -> List[Dict[str, Any]]:
        """Extract tables using pdfplumber."""
        tables = []
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    page_tables = page.extract_tables()
                    
                    for table_index, table in enumerate(page_tables):
                        if table:
                            tables.append({
                                'page': page_num,
                                'index': table_index,
                                'data': table,
                                'bbox': getattr(page.within_bbox(page.bbox).extract_tables()[table_index], 'bbox', []),
                                'rows': len(table),
                                'cols': len(table[0]) if table else 0
                            })
        
        except Exception as e:
            logger.warning(f"Failed to extract tables: {str(e)}")
        
        return tables
    
    def _detect_structure(self, text_content: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Enhanced document structure detection for academic papers."""
        structure = {
            'sections': [],
            'title': '',
            'abstract': '',
            'references_start': -1
        }
        
        current_section = None
        
        for i, block in enumerate(text_content):
            text = block['text'].strip()
            text_lower = text.lower()
            block_type = block['type']
            
            # Extract title (usually first large text block)
            if not structure['title'] and block_type in ['title', 'heading']:
                structure['title'] = text
            
            # Enhanced section detection - check both block type and patterns
            is_section_heading = (
                block_type == 'section_heading' or 
                self._is_likely_section_heading(text, block)
            )
            
            if is_section_heading:
                if current_section:
                    current_section['end_index'] = i - 1
                
                current_section = {
                    'title': text,
                    'start_index': i,
                    'page': block['page'],
                    'type': self._categorize_section(text_lower)
                }
                structure['sections'].append(current_section)
                
                # Special handling for abstract and references
                if 'abstract' in text_lower:
                    structure['abstract_start'] = i
                elif 'reference' in text_lower or 'bibliography' in text_lower:
                    structure['references_start'] = i
        
        # Close last section
        if current_section:
            current_section['end_index'] = len(text_content) - 1
        
        # If we found very few sections, try a more aggressive approach
        if len(structure['sections']) < 3:
            structure = self._aggressive_section_detection(text_content, structure)
        
        return structure
    
    def _is_likely_section_heading(self, text: str, block: Dict) -> bool:
        """More aggressive section heading detection."""
        text_lower = text.lower().strip()
        
        # Check against patterns
        for pattern in self.section_patterns:
            if re.match(pattern, text_lower, re.IGNORECASE):
                return True
        
        # Check for numbered sections (e.g., "3.1 Model Architecture")
        if re.match(r'^\d+(\.\d+)*\.?\s+[A-Z][a-zA-Z\s]+', text):
            return True
        
        # Check for ALL CAPS headings
        if text.isupper() and len(text.split()) <= 4 and len(text) > 5:
            return True
        
        # Check for bold text that looks like headings
        font_info = block.get('font_info', [])
        if font_info:
            avg_size = sum(f.get('size', 0) for f in font_info) / len(font_info)
            if avg_size > 12 and len(text.split()) <= 6:
                return True
        
        return False
    
    def _aggressive_section_detection(self, text_content: List[Dict[str, Any]], structure: Dict) -> Dict:
        """More aggressive section detection when normal detection fails."""
        # Look for common academic paper patterns in content
        sections = []
        
        for i, block in enumerate(text_content):
            text = block['text'].strip()
            text_lower = text.lower()
            
            # Look for text blocks that start with common section words
            if any(text_lower.startswith(word) for word in [
                'abstract', 'introduction', 'background', 'method', 'approach',
                'experiment', 'result', 'evaluation', 'discussion', 'conclusion',
                'reference', 'bibliography'
            ]):
                sections.append({
                    'title': text,
                    'start_index': i,
                    'page': block['page'],
                    'type': self._categorize_section(text_lower),
                    'end_index': None
                })
        
        # Set end indices
        for j in range(len(sections)):
            if j < len(sections) - 1:
                sections[j]['end_index'] = sections[j + 1]['start_index'] - 1
            else:
                sections[j]['end_index'] = len(text_content) - 1
        
        if sections:
            structure['sections'] = sections
            
        return structure
    
    def _categorize_section(self, section_title: str) -> str:
        """Categorize section based on title."""
        title_lower = section_title.lower()
        
        if 'abstract' in title_lower:
            return 'abstract'
        elif 'introduction' in title_lower:
            return 'introduction'
        elif 'method' in title_lower or 'approach' in title_lower:
            return 'methodology'
        elif 'result' in title_lower or 'experiment' in title_lower:
            return 'results'
        elif 'discussion' in title_lower:
            return 'discussion'
        elif 'conclusion' in title_lower:
            return 'conclusion'
        elif 'reference' in title_lower or 'bibliography' in title_lower:
            return 'references'
        else:
            return 'other'