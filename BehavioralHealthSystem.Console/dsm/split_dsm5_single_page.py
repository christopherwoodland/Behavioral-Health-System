#!/usr/bin/env python3
"""
DSM5 Single-Page Diagnostic Splitter

This script splits the DSM5.pdf file into individual single-page diagnostic items.
Each diagnostic item is condensed onto one page with scaled text for computer readability.

Requirements:
    pip install pdfplumber PyPDF2 reportlab

Usage:
    python split_dsm5_single_page.py
"""

import os
import re
import pdfplumber
from PyPDF2 import PdfReader, PdfWriter
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from io import BytesIO
from pathlib import Path
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class DSMSinglePageSplitter:
    def __init__(self, input_file, output_dir="single-pages"):
        self.input_file = input_file
        self.output_dir = output_dir
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
                            'text': text
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
        current_text = []
        
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
                
                # Look for disorder title followed by "Diagnostic Criteria" and code
                disorder_keywords = ['disorder', 'syndrome', 'episode', 'condition', 'phobia', 'anxiety', 'depression', 'bipolar']
                
                # Check if this is a standalone disorder title
                if (any(keyword in line.lower() for keyword in disorder_keywords) and
                    len(line.split()) <= 8 and not line.endswith('.') and
                    not re.match(r'^\d+\.', line) and
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
                            current_item['full_text'] = '\n'.join(current_text)
                            diagnostic_items.append(current_item)
                            current_text = []
                        
                        # Start new diagnostic item
                        current_item = {
                            'title': line,
                            'diagnostic_code': diagnostic_code,
                            'start_page': page_num,
                            'has_criteria': True,
                            'has_comorbidity': False,
                            'end_page': page_num,
                            'comorbidity_page': None
                        }
                        current_text = [f"{line}\n{diagnostic_code}\n\n"]
                        logger.info(f"Found diagnostic item: {line} [{diagnostic_code}]")
                
                # Add current line to text if we're collecting
                if current_item:
                    current_text.append(line)
                
                # Look for "Comorbidity" section (marks end of current disorder)
                if (current_item and 
                    re.match(r'^Comorbidity\s*$', line, re.IGNORECASE)):
                    
                    current_item['has_comorbidity'] = True
                    current_item['comorbidity_page'] = page_num
                    current_item['end_page'] = page_num
                    logger.info(f"Found comorbidity section for: {current_item['title']}")
                
                # Update current item end page
                if current_item:
                    current_item['end_page'] = page_num
                
                i += 1
        
        # Add the last item if it has comorbidity
        if current_item and current_item.get('has_comorbidity', False):
            current_item['full_text'] = '\n'.join(current_text)
            diagnostic_items.append(current_item)
        
        # Filter items to only include complete diagnostic sections
        complete_items = []
        for item in diagnostic_items:
            if (item.get('has_criteria', False) and 
                item.get('has_comorbidity', False) and 
                item.get('diagnostic_code') and
                item.get('full_text')):
                complete_items.append(item)
                
        return complete_items
    
    def detect_section_headers(self, text):
        """Detect and mark section headers in the text."""
        # Common DSM-5 section headers
        section_headers = [
            'Diagnostic Criteria',
            'Diagnostic Features',
            'Associated Features Supporting Diagnosis',
            'Associated Features',
            'Prevalence',
            'Development and Course',
            'Risk and Prognostic Factors',
            'Culture-Related Diagnostic Issues',
            'Gender-Related Diagnostic Issues',
            'Suicide Risk',
            'Functional Consequences',
            'Differential Diagnosis',
            'Comorbidity',
            'Specifiers',
            'Subtypes',
            'Recording Procedures',
            'Diagnostic Markers',
            'Consequences'
        ]
        
        lines = text.split('\n')
        processed_lines = []
        
        for line in lines:
            stripped = line.strip()
            
            # Check if line matches a section header (exactly or starts with)
            is_header = False
            for header in section_headers:
                if stripped == header or (stripped.startswith(header) and len(stripped) < len(header) + 50):
                    is_header = True
                    break
            
            if is_header:
                processed_lines.append(('HEADER', stripped))
            elif stripped:
                processed_lines.append(('TEXT', stripped))
        
        return processed_lines
    
    def create_single_page_pdf(self, item, output_path):
        """Create a single-page PDF with scaled text to fit all content."""
        try:
            buffer = BytesIO()
            
            # Create PDF with letter size
            c = canvas.Canvas(buffer, pagesize=letter)
            width, height = letter
            
            # Set up margins (smaller for more space)
            margin = 0.25 * inch
            usable_width = width - (2 * margin)
            usable_height = height - (2 * margin)
            
            # Title and header
            c.setFont("Helvetica-Bold", 9)
            title = item['title'][:100]  # Limit title length
            c.drawString(margin, height - margin, title)
            
            c.setFont("Helvetica", 7)
            code_text = f"Code: {item['diagnostic_code']}"
            c.drawString(margin, height - margin - 0.15*inch, code_text)
            
            # Draw a line separator
            c.line(margin, height - margin - 0.2*inch, width - margin, height - margin - 0.2*inch)
            
            # Prepare text content with section headers
            text = item.get('full_text', '')
            processed_content = self.detect_section_headers(text)
            
            # Calculate font size based on content length
            text_length = len(text)
            if text_length < 2000:
                font_size = 6
                line_spacing = 7
                header_size = 7
            elif text_length < 4000:
                font_size = 5
                line_spacing = 6
                header_size = 6
            elif text_length < 6000:
                font_size = 4
                line_spacing = 5
                header_size = 5
            else:
                font_size = 3.5
                line_spacing = 4.5
                header_size = 4.5
            
            # Start position for text (below header)
            y_position = height - margin - 0.35*inch
            
            # Process content into formatted lines with type markers
            formatted_lines = []
            
            for content_type, content_text in processed_content:
                if content_type == 'HEADER':
                    # Add header as a single formatted line
                    formatted_lines.append(('HEADER', content_text))
                else:
                    # Split regular text into word-wrapped lines
                    words = content_text.split()
                    current_line = ""
                    
                    for word in words:
                        test_line = current_line + " " + word if current_line else word
                        # Use regular font size for width calculation
                        test_width = c.stringWidth(test_line, "Helvetica", font_size)
                        if test_width < usable_width:
                            current_line = test_line
                        else:
                            if current_line:
                                formatted_lines.append(('TEXT', current_line))
                            current_line = word
                    
                    if current_line:
                        formatted_lines.append(('TEXT', current_line))
            
            # Calculate maximum lines that fit on page
            # Headers take slightly more space
            header_spacing = line_spacing * 1.5
            total_height_needed = sum(header_spacing if lt == 'HEADER' else line_spacing 
                                     for lt, _ in formatted_lines)
            
            # If content doesn't fit, scale down
            if total_height_needed > usable_height:
                scale_factor = usable_height / total_height_needed
                font_size = max(2.5, font_size * scale_factor)
                header_size = max(3, header_size * scale_factor)
                line_spacing = max(3, line_spacing * scale_factor)
                header_spacing = line_spacing * 1.5
            
            # Draw all lines with proper formatting
            lines_drawn = 0
            for line_type, line_text in formatted_lines:
                # Stop if we've run out of space
                if y_position < margin:
                    break
                
                if line_type == 'HEADER':
                    # Draw header in bold with slightly larger font
                    c.setFont("Helvetica-Bold", header_size)
                    c.drawString(margin, y_position, line_text[:200])
                    y_position -= header_spacing
                else:
                    # Draw regular text
                    c.setFont("Helvetica", font_size)
                    c.drawString(margin, y_position, line_text[:250])
                    y_position -= line_spacing
                
                lines_drawn += 1
            
            # Add footer with page info
            c.setFont("Helvetica", 5)
            footer_text = f"DSM-5 Diagnostic Item | Pages {item['start_page']+1}-{item['end_page']+1} | Computer-Readable Format"
            c.drawString(margin, margin/2, footer_text)
            
            c.showPage()
            c.save()
            
            # Write to file
            buffer.seek(0)
            with open(output_path, 'wb') as f:
                f.write(buffer.read())
                
            return True
            
        except Exception as e:
            logger.error(f"Error creating single-page PDF: {str(e)}")
            return False
    
    def create_single_page_pdfs(self, diagnostic_items):
        """Create separate single-page PDF files for each diagnostic item."""
        if not diagnostic_items:
            logger.warning("No diagnostic items found!")
            return
        
        # Create output directory
        Path(self.output_dir).mkdir(exist_ok=True)
        
        logger.info(f"Creating single-page PDFs for {len(diagnostic_items)} diagnostic items...")
        logger.info(f"Output directory: {self.output_dir}")
        
        success_count = 0
        
        for idx, item in enumerate(diagnostic_items):
            # Clean the title for filename
            clean_title = re.sub(r'[^\w\s-]', '', item['title'])
            clean_title = re.sub(r'\s+', '_', clean_title.strip())
            clean_title = clean_title[:50]  # Limit filename length
            
            # Include diagnostic code in filename
            code_part = item['diagnostic_code'].replace('(', '').replace(')', '').replace('.', '_').replace(' ', '_')
            output_filename = f"dsm5_{code_part}_{clean_title}.pdf"
            output_path = os.path.join(self.output_dir, output_filename)
            
            if self.create_single_page_pdf(item, output_path):
                success_count += 1
                logger.info(f"Created: {output_filename}")
                logger.info(f"  Title: {item['title']}")
                logger.info(f"  Code: {item['diagnostic_code']}")
                logger.info(f"  Text length: {len(item.get('full_text', ''))} characters")
            else:
                logger.error(f"Failed to create: {output_filename}")
        
        logger.info(f"\nSuccessfully created {success_count}/{len(diagnostic_items)} single-page PDFs")
    
    def split_by_diagnostic_items(self):
        """Main method to split PDF by diagnostic items into single pages."""
        logger.info("Starting DSM-5 single-page diagnostic item extraction...")
        logger.info("Each diagnostic item will be condensed onto ONE page")
        logger.info("Pattern: Disorder Title -> Diagnostic Criteria + Code -> Content -> Comorbidity")
        
        # Check if input file exists
        if not os.path.exists(self.input_file):
            logger.error(f"Input file '{self.input_file}' not found.")
            return
        
        # Extract text with page information
        text_pages = self.extract_text_with_pages()
        if not text_pages:
            logger.error("Failed to extract text from PDF.")
            return
        
        # Find diagnostic sections
        diagnostic_items = self.find_diagnostic_sections(text_pages)
        logger.info(f"Found {len(diagnostic_items)} complete diagnostic sections.")
        
        # Create individual single-page PDFs
        self.create_single_page_pdfs(diagnostic_items)
        
        # Print summary
        logger.info("\n" + "="*80)
        logger.info("SUMMARY OF SINGLE-PAGE DIAGNOSTIC ITEMS CREATED:")
        logger.info("="*80)
        for idx, item in enumerate(diagnostic_items):
            logger.info(f"{idx+1:3d}. {item['diagnostic_code']} - {item['title']}")
        
        logger.info(f"\nTotal single-page diagnostic items created: {len(diagnostic_items)}")
        logger.info(f"Output directory: {self.output_dir}")
        logger.info("Each PDF is ONE PAGE with scaled text optimized for computer readability")


def main():
    """Main function to run the single-page diagnostic item splitter."""
    input_file = "DSM5.pdf"
    output_dir = "single-pages"
    
    print("DSM-5 Single-Page Diagnostic Items Splitter")
    print("=" * 50)
    print("This tool extracts individual diagnostic items from the DSM-5 PDF.")
    print("Each diagnostic item is condensed onto ONE PAGE for computer readability.")
    print("Pattern: Disorder Name -> Diagnostic Criteria + Code -> Content -> Comorbidity")
    print(f"Output directory: {output_dir}/")
    print()
    
    splitter = DSMSinglePageSplitter(input_file, output_dir)
    splitter.split_by_diagnostic_items()


if __name__ == "__main__":
    main()
