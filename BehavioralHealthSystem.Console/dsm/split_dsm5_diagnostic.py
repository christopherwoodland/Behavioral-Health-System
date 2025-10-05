#!/usr/bin/env python3
"""
DSM5 Diagnostic Items Splitter

This script splits the DSM5.pdf file into individual diagnostic items.
Each diagnostic item starts with a header and contains "Diagnostic Criteria".

Requirements:
    pip install pdfplumber PyPDF2 reportlab

Usage:
    python split_dsm5_diagnostic.py
"""

import os
import re
import pdfplumber
from PyPDF2 import PdfReader, PdfWriter
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class DSMDiagnosticSplitter:
    def __init__(self, input_file):
        self.input_file = input_file
        self.diagnostic_items = []
        
    def extract_text_with_pages(self):
        """Extract text from PDF with page information."""
        text_pages = []
        
        try:
            with pdfplumber.open(self.input_file) as pdf:
                logger.info(f"Processing {len(pdf.pages)} pages...")
                
                for page_num, page in enumerate(pdf.pages):
                    text = page.extract_text()
                    if text:
                        text_pages.append({
                            'page_num': page_num,
                            'text': text,
                            'page_obj': page
                        })
                        
                        # Log progress every 50 pages
                        if (page_num + 1) % 50 == 0:
                            logger.info(f"Processed {page_num + 1} pages...")
                            
        except Exception as e:
            logger.error(f"Error extracting text: {str(e)}")
            return []
            
        return text_pages
    
    def find_diagnostic_sections(self, text_pages):
        """Find diagnostic sections using the actual DSM-5 structure."""
        diagnostic_items = []
        current_item = None
        
        for page_info in text_pages:
            page_num = page_info['page_num']
            text = page_info['text']
            lines = text.split('\n')
            
            i = 0
            while i < len(lines):
                line = lines[i].strip()
                
                if not line:
                    i += 1
                    continue
                
                # Pattern 1: Look for disorder title followed by "Diagnostic Criteria" and code
                # Example: "Autism Spectrum Disorder" followed by "Diagnostic Criteria 299.00 (F84.0)"
                disorder_keywords = ['disorder', 'syndrome', 'episode', 'condition', 'phobia', 'anxiety', 'depression', 'bipolar']
                
                # Check if this is a standalone disorder title
                if (any(keyword in line.lower() for keyword in disorder_keywords) and
                    len(line.split()) <= 8 and not line.endswith('.') and
                    not re.match(r'^\d+\.', line) and  # Not a numbered item
                    not line.lower().startswith('specify') and
                    not line.lower().startswith('note:') and
                    not line.lower().startswith('with')):
                    
                    # Look ahead for "Diagnostic Criteria" with code
                    found_criteria = False
                    criteria_line = ""
                    diagnostic_code = ""
                    
                    for j in range(i + 1, min(i + 5, len(lines))):
                        next_line = lines[j].strip()
                        
                        # Look for "Diagnostic Criteria" followed by code pattern
                        if re.search(r'diagnostic\s+criteria', next_line, re.IGNORECASE):
                            criteria_line = next_line
                            
                            # Extract diagnostic code (e.g., "299.00 (F84.0)")
                            code_match = re.search(r'\b(\d{3}\.\d+)\s*\(([A-Z]\d+[\.\d]*)\)', next_line)
                            if code_match:
                                diagnostic_code = f"{code_match.group(1)} ({code_match.group(2)})"
                                found_criteria = True
                                break
                    
                    if found_criteria:
                        # Save previous item if exists
                        if current_item and current_item.get('has_comorbidity', False):
                            diagnostic_items.append(current_item)
                        
                        # Start new diagnostic item
                        current_item = {
                            'title': line,
                            'diagnostic_code': diagnostic_code,
                            'start_page': page_num,
                            'start_line': i,
                            'content_pages': [page_num],
                            'has_criteria': True,
                            'has_comorbidity': False,
                            'end_page': page_num,
                            'comorbidity_page': None
                        }
                        logger.info(f"Found diagnostic item: {line} [{diagnostic_code}]")
                
                # Pattern 2: Look for "Comorbidity" section (marks end of current disorder)
                if (current_item and 
                    re.match(r'^Comorbidity\s*$', line, re.IGNORECASE)):
                    
                    current_item['has_comorbidity'] = True
                    current_item['comorbidity_page'] = page_num
                    current_item['end_page'] = page_num
                    logger.info(f"Found comorbidity section for: {current_item['title']}")
                
                # Update current item pages
                if current_item:
                    current_item['end_page'] = page_num
                    if page_num not in current_item['content_pages']:
                        current_item['content_pages'].append(page_num)
                
                i += 1
        
        # Add the last item if it has comorbidity
        if current_item and current_item.get('has_comorbidity', False):
            diagnostic_items.append(current_item)
        
        # Filter items to only include complete diagnostic sections
        complete_items = []
        for item in diagnostic_items:
            if (item.get('has_criteria', False) and 
                item.get('has_comorbidity', False) and 
                item.get('diagnostic_code')):
                complete_items.append(item)
                
        return complete_items
    
    def create_diagnostic_pdfs(self, diagnostic_items):
        """Create separate PDF files for each diagnostic item."""
        if not diagnostic_items:
            logger.warning("No diagnostic items found!")
            return
        
        logger.info(f"Creating PDFs for {len(diagnostic_items)} diagnostic items...")
        
        try:
            pdf_reader = PdfReader(self.input_file)
            
            for idx, item in enumerate(diagnostic_items):
                # Clean the title for filename
                clean_title = re.sub(r'[^\w\s-]', '', item['title'])
                clean_title = re.sub(r'\s+', '_', clean_title.strip())
                clean_title = clean_title[:50]  # Limit filename length
                
                # Include diagnostic code in filename
                code_part = item['diagnostic_code'].replace('(', '').replace(')', '').replace('.', '_')
                output_filename = f"dsm5_{code_part}_{clean_title}.pdf"
                
                # Create PDF writer
                pdf_writer = PdfWriter()
                
                # Add pages for this diagnostic item (from start to comorbidity end)
                start_page = item['start_page']
                end_page = item['end_page']
                
                # Add a few extra pages after comorbidity to ensure complete content
                if item.get('comorbidity_page'):
                    end_page = min(item['comorbidity_page'] + 2, len(pdf_reader.pages) - 1)
                
                for page_num in range(start_page, end_page + 1):
                    if page_num < len(pdf_reader.pages):
                        pdf_writer.add_page(pdf_reader.pages[page_num])
                
                # Write the PDF file
                with open(output_filename, 'wb') as output_file:
                    pdf_writer.write(output_file)
                
                logger.info(f"Created: {output_filename}")
                logger.info(f"  Title: {item['title']}")
                logger.info(f"  Code: {item['diagnostic_code']}")
                logger.info(f"  Pages: {start_page + 1} to {end_page + 1}")
                logger.info(f"  Has Comorbidity: {item['has_comorbidity']}")
                
        except Exception as e:
            logger.error(f"Error creating PDFs: {str(e)}")
    
    def split_by_diagnostic_items(self):
        """Main method to split PDF by diagnostic items."""
        logger.info("Starting DSM-5 diagnostic item extraction...")
        logger.info("Looking for pattern: Disorder Title -> Diagnostic Criteria + Code -> ... -> Comorbidity")
        
        # Check if input file exists
        if not os.path.exists(self.input_file):
            logger.error(f"Input file '{self.input_file}' not found.")
            return
        
        # Extract text with page information
        text_pages = self.extract_text_with_pages()
        if not text_pages:
            logger.error("Failed to extract text from PDF.")
            return
        
        # Find diagnostic sections using the proper DSM-5 structure
        diagnostic_items = self.find_diagnostic_sections(text_pages)
        logger.info(f"Found {len(diagnostic_items)} complete diagnostic sections.")
        
        # Create individual PDFs
        self.create_diagnostic_pdfs(diagnostic_items)
        
        # Print summary
        logger.info("\n" + "="*80)
        logger.info("SUMMARY OF DIAGNOSTIC ITEMS FOUND:")
        logger.info("="*80)
        for idx, item in enumerate(diagnostic_items):
            logger.info(f"{idx+1:3d}. {item['diagnostic_code']} - {item['title']}")
        
        logger.info(f"\nTotal diagnostic items extracted: {len(diagnostic_items)}")
        logger.info("Each PDF contains: Disorder Title -> Diagnostic Criteria -> Content -> Comorbidity")
        logger.info("Files named as: dsm5_[CODE]_[DISORDER_NAME].pdf")


def main():
    """Main function to run the diagnostic item splitter."""
    input_file = "DSM5.pdf"
    
    print("DSM-5 Diagnostic Items Splitter")
    print("===============================")
    print("This tool extracts individual diagnostic items from the DSM-5 PDF.")
    print("Pattern: Disorder Name -> Diagnostic Criteria + Code -> Content -> Comorbidity")
    print("Each complete diagnostic section will be saved as a separate PDF file.")
    print("Files named as: dsm5_[CODE]_[DISORDER_NAME].pdf")
    print()
    
    splitter = DSMDiagnosticSplitter(input_file)
    splitter.split_by_diagnostic_items()


if __name__ == "__main__":
    main()