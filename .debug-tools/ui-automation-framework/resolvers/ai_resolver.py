"""
AI Element Resolver - Natural language element selection
Uses fuzzy matching + semantic similarity for element selection
"""

from typing import Dict, List, Optional, Any
from difflib import SequenceMatcher
import re


class AIElementResolver:
    """Resolve natural language queries to UI elements"""
    
    def __init__(self, backend_selector):
        self.backend_selector = backend_selector
        self.element_registry = []
    
    def update_registry(self, elements: List[Dict]):
        """Update element registry"""
        self.element_registry = elements
    
    def resolve(self, query: str, action: str = 'click') -> Optional[Dict]:
        """
        Resolve natural language query to a UI element
        
        Args:
            query: Natural language description (e.g., "sessions tab", "save button")
            action: Action type (click, hover, type, check)
        
        Returns:
            Dict with 'element' and 'confidence' or None
        """
        if not self.element_registry:
            return None
        
        query_lower = query.lower()
        
        # Strategy 1: Exact label match
        for elem in self.element_registry:
            label = elem.get('label', '').lower()
            if label == query_lower:
                return {
                    'element': elem,
                    'confidence': 1.0,
                    'match_type': 'exact_label'
                }
        
        # Strategy 2: Label contains query
        for elem in self.element_registry:
            label = elem.get('label', '').lower()
            if query_lower in label and elem.get('visible'):
                return {
                    'element': elem,
                    'confidence': 0.95,
                    'match_type': 'label_contains'
                }
        
        # Strategy 3: Query contains label
        for elem in self.element_registry:
            label = elem.get('label', '').lower()
            if label and label in query_lower and elem.get('visible'):
                return {
                    'element': elem,
                    'confidence': 0.90,
                    'match_type': 'query_contains_label'
                }
        
        # Strategy 4: Type-aware matching
        # Extract type hints from query (button, tab, input, etc.)
        type_match = self._extract_type_hint(query_lower)
        if type_match:
            typed_elements = [e for e in self.element_registry 
                            if e.get('type') == type_match and e.get('visible')]
            
            # Find best match within typed elements
            best_match = self._fuzzy_match(query_lower, typed_elements)
            if best_match:
                return {
                    'element': best_match['element'],
                    'confidence': best_match['score'] * 0.85,
                    'match_type': 'type_aware_fuzzy'
                }
        
        # Strategy 5: Fuzzy matching across all visible elements
        visible_elements = [e for e in self.element_registry if e.get('visible')]
        best_match = self._fuzzy_match(query_lower, visible_elements)
        
        if best_match and best_match['score'] >= 0.5:
            return {
                'element': best_match['element'],
                'confidence': best_match['score'],
                'match_type': 'fuzzy_match'
            }
        
        # Strategy 6: Semantic keyword matching
        keywords = self._extract_keywords(query_lower)
        if keywords:
            scored_elements = []
            for elem in visible_elements:
                score = self._keyword_match_score(keywords, elem)
                if score > 0:
                    scored_elements.append({'element': elem, 'score': score})
            
            if scored_elements:
                best = max(scored_elements, key=lambda x: x['score'])
                return {
                    'element': best['element'],
                    'confidence': min(best['score'], 0.80),
                    'match_type': 'semantic_keywords'
                }
        
        return None
    
    def _extract_type_hint(self, query: str) -> Optional[str]:
        """Extract element type from query"""
        type_keywords = {
            'button': ['button', 'btn'],
            'input': ['input', 'field', 'textbox', 'text box'],
            'tab': ['tab'],
            'menu': ['menu'],
            'list': ['list'],
            'tree': ['tree'],
            'window': ['window'],
            'pane': ['pane', 'panel']
        }
        
        for elem_type, keywords in type_keywords.items():
            for keyword in keywords:
                if keyword in query:
                    return elem_type
        
        return None
    
    def _fuzzy_match(self, query: str, elements: List[Dict]) -> Optional[Dict]:
        """Find best fuzzy match"""
        best_score = 0
        best_element = None
        
        for elem in elements:
            # Match against label
            label = elem.get('label', '').lower()
            if label:
                score = SequenceMatcher(None, query, label).ratio()
                if score > best_score:
                    best_score = score
                    best_element = elem
            
            # Match against text
            text = elem.get('text', '').lower()
            if text:
                score = SequenceMatcher(None, query, text).ratio()
                if score > best_score:
                    best_score = score
                    best_element = elem
        
        if best_element:
            return {'element': best_element, 'score': best_score}
        
        return None
    
    def _extract_keywords(self, query: str) -> List[str]:
        """Extract meaningful keywords from query"""
        # Remove type hints
        query = re.sub(r'\b(button|input|tab|menu|list|field|box)\b', '', query)
        
        # Remove common words
        stopwords = {'the', 'a', 'an', 'to', 'in', 'on', 'at', 'for', 'with'}
        words = query.split()
        keywords = [w for w in words if w not in stopwords and len(w) > 2]
        
        return keywords
    
    def _keyword_match_score(self, keywords: List[str], element: Dict) -> float:
        """Calculate keyword match score"""
        label = element.get('label', '').lower()
        text = element.get('text', '').lower()
        elem_type = element.get('type', '').lower()
        
        score = 0.0
        for keyword in keywords:
            if keyword in label:
                score += 0.5
            if keyword in text:
                score += 0.3
            if keyword in elem_type:
                score += 0.2
        
        return min(score, 1.0)
    
    def find_similar(self, query: str, limit: int = 3) -> List[Dict]:
        """Find similar elements to query"""
        query_lower = query.lower()
        visible_elements = [e for e in self.element_registry if e.get('visible')]
        
        # Score all elements
        scored = []
        for elem in visible_elements:
            label = elem.get('label', '').lower()
            if label:
                score = SequenceMatcher(None, query_lower, label).ratio()
                scored.append({'element': elem, 'score': score})
        
        # Sort by score
        scored.sort(key=lambda x: x['score'], reverse=True)
        
        return [item['element'] for item in scored[:limit]]
