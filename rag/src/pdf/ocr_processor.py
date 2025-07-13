import easyocr
import cv2
import numpy as np
from PIL import Image
import base64
import io
import re
from typing import Dict, List, Any, Optional
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

class OCRProcessor:
    def __init__(self):
        try:
            # Initialize EasyOCR with English support
            self.reader = easyocr.Reader(['en'])
            logger.info("OCR processor initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize OCR processor: {str(e)}")
            self.reader = None
    
    def process_image(self, image_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process image to extract text and classify content."""
        if not self.reader:
            logger.warning("OCR reader not available")
            return image_data
        
        try:
            # Decode base64 image
            image_bytes = base64.b64decode(image_data['data'])
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to numpy array for processing
            image_np = np.array(image)
            
            # Extract text using OCR
            ocr_results = self.reader.readtext(image_np)
            
            # Process OCR results
            extracted_text = self._process_ocr_results(ocr_results)
            
            # Classify image content
            content_type = self._classify_image_content(extracted_text, image_data.get('type', 'unknown'))
            
            # Enhanced image data
            enhanced_data = image_data.copy()
            enhanced_data.update({
                'ocr_text': extracted_text,
                'content_type': content_type,
                'has_text': bool(extracted_text.strip()),
                'text_confidence': self._calculate_confidence(ocr_results),
                'text_regions': self._extract_text_regions(ocr_results)
            })
            
            return enhanced_data
            
        except Exception as e:
            logger.error(f"Error processing image with OCR: {str(e)}")
            return image_data
    
    def process_formula_image(self, image_data: Dict[str, Any]) -> Dict[str, Any]:
        """Special processing for mathematical formulas in images."""
        if not self.reader:
            return image_data
        
        try:
            # Decode and preprocess image for better formula recognition
            image_bytes = base64.b64decode(image_data['data'])
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to grayscale and enhance contrast for formulas
            image_np = np.array(image.convert('L'))
            
            # Apply image enhancement for better OCR
            enhanced_image = self._enhance_for_formulas(image_np)
            
            # Extract text
            ocr_results = self.reader.readtext(enhanced_image)
            extracted_text = self._process_ocr_results(ocr_results)
            
            # Try to detect mathematical symbols and notation
            math_symbols = self._detect_math_symbols(extracted_text)
            
            enhanced_data = image_data.copy()
            enhanced_data.update({
                'ocr_text': extracted_text,
                'content_type': 'formula',
                'math_symbols': math_symbols,
                'is_formula': True,
                'formula_complexity': self._assess_formula_complexity(extracted_text)
            })
            
            return enhanced_data
            
        except Exception as e:
            logger.error(f"Error processing formula image: {str(e)}")
            return image_data
    
    def _process_ocr_results(self, ocr_results: List) -> str:
        """Process OCR results and combine into text."""
        text_parts = []
        
        for result in ocr_results:
            if len(result) >= 2:
                text = result[1]
                confidence = result[2] if len(result) > 2 else 0.0
                
                # Only include text with reasonable confidence
                if confidence > 0.3:
                    text_parts.append(text)
        
        return ' '.join(text_parts)
    
    def _classify_image_content(self, ocr_text: str, image_type: str) -> str:
        """Classify image content based on OCR text and type."""
        text_lower = ocr_text.lower()
        
        # Check for mathematical content
        math_indicators = ['equation', 'formula', '∑', '∫', '∂', '∇', '±', '≤', '≥', '≠', '∞']
        if any(indicator in text_lower for indicator in math_indicators):
            return 'mathematical'
        
        # Check for chart/graph indicators
        chart_indicators = ['figure', 'chart', 'graph', 'plot', 'axis', 'data', 'percentage', '%']
        if any(indicator in text_lower for indicator in chart_indicators):
            return 'chart'
        
        # Check for table indicators
        table_indicators = ['table', 'column', 'row', 'cell']
        if any(indicator in text_lower for indicator in table_indicators):
            return 'table'
        
        # Check for diagram indicators
        diagram_indicators = ['diagram', 'schema', 'flow', 'process', 'step']
        if any(indicator in text_lower for indicator in diagram_indicators):
            return 'diagram'
        
        return image_type or 'figure'
    
    def _calculate_confidence(self, ocr_results: List) -> float:
        """Calculate average confidence of OCR results."""
        if not ocr_results:
            return 0.0
        
        confidences = []
        for result in ocr_results:
            if len(result) > 2:
                confidences.append(result[2])
        
        return sum(confidences) / len(confidences) if confidences else 0.0
    
    def _extract_text_regions(self, ocr_results: List) -> List[Dict]:
        """Extract text regions with bounding boxes."""
        regions = []
        
        for result in ocr_results:
            if len(result) >= 3:
                bbox = result[0]
                text = result[1]
                confidence = result[2]
                
                regions.append({
                    'text': text,
                    'bbox': bbox,
                    'confidence': confidence
                })
        
        return regions
    
    def _enhance_for_formulas(self, image: np.ndarray) -> np.ndarray:
        """Enhance image for better formula recognition."""
        # Apply adaptive thresholding
        thresh = cv2.adaptiveThreshold(
            image, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        
        # Remove noise
        kernel = np.ones((1, 1), np.uint8)
        cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        
        return cleaned
    
    def _detect_math_symbols(self, text: str) -> List[str]:
        """Detect mathematical symbols in text."""
        math_symbols = []
        
        # Common mathematical symbols that might be detected
        symbol_patterns = {
            'integral': ['∫', 'integral'],
            'summation': ['∑', 'sum'],
            'derivative': ['∂', 'partial', 'd/dx'],
            'gradient': ['∇', 'gradient'],
            'infinity': ['∞', 'infinity'],
            'greek_letters': ['α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'μ', 'π', 'σ', 'φ', 'ψ', 'ω'],
            'operators': ['±', '≤', '≥', '≠', '≈', '∈', '∉', '⊂', '⊆', '∪', '∩']
        }
        
        for category, symbols in symbol_patterns.items():
            for symbol in symbols:
                if symbol in text:
                    math_symbols.append(f"{category}:{symbol}")
        
        return math_symbols
    
    def _assess_formula_complexity(self, text: str) -> str:
        """Assess the complexity of a mathematical formula."""
        # Count mathematical operators and symbols
        math_indicators = len(re.findall(r'[∑∏∫∂∇±≤≥≠≈∈∉⊂⊆∪∩]', text))
        greek_letters = len(re.findall(r'[αβγδεζηθικλμνξοπρστυφχψω]', text))
        parentheses = len(re.findall(r'[(){}[\]]', text))
        
        complexity_score = math_indicators + greek_letters + (parentheses // 2)
        
        if complexity_score >= 10:
            return 'high'
        elif complexity_score >= 5:
            return 'medium'
        else:
            return 'low'