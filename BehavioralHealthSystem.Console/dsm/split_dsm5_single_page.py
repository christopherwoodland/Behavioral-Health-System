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
        """Find diagnostic sections using the actual DSM-5 structure.
        Pattern: Disorder Title (line) -> "Diagnostic Criteria" (next line) -> Code (same or next line)
        """
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
                
                # Look for "Diagnostic Criteria" which should follow a disorder title
                # Pattern 1: "Diagnostic Criteria" on its own line
                # Pattern 2: "Diagnostic Criteria 292.0 (F12.288)" - criteria + code on same line
                criteria_match = re.match(r'^\s*Diagnostic\s+Criteria\s*(.*)$', line, re.IGNORECASE)
                
                if criteria_match:
                    # Before starting a new disorder, save the previous one if it exists
                    if current_item and not current_item.get('item_saved', False):
                        current_item['end_page'] = page_num
                        current_item['full_text'] = '\n'.join(current_text)
                        current_item['item_saved'] = True
                        diagnostic_items.append(current_item)
                        logger.info(f"Saved item: {current_item['title']} (found next disorder)")
                        # Reset for next item
                        current_item = None
                        current_text = []
                    
                    # Look backwards for the disorder title (previous non-empty line)
                    disorder_title = ""
                    for j in range(i - 1, max(i - 5, -1), -1):
                        prev_line = lines[j].strip()
                        if prev_line and not re.match(r'^\d+$', prev_line):  # Skip page numbers
                            disorder_title = prev_line
                            break
                    
                    if disorder_title:
                        # Check if code is on the same line as "Diagnostic Criteria"
                        remaining_text = criteria_match.group(1).strip()
                        code_match = re.search(r'\b(\d{3}\.\d+)\s*\(([A-Z]\d+[\.\d]*)\)', remaining_text)
                        
                        if code_match:
                            # Code is on the same line
                            diagnostic_code = f"{code_match.group(1)} ({code_match.group(2)})"
                        else:
                            # Look ahead for diagnostic code on next lines
                            diagnostic_code = ""
                            for j in range(i + 1, min(i + 5, len(lines))):
                                next_line = lines[j].strip()
                                
                                # Extract diagnostic code (e.g., "292.0 (F12.288)" or "299.00 (F84.0)")
                                code_match = re.search(r'\b(\d{3}\.\d+)\s*\(([A-Z]\d+[\.\d]*)\)', next_line)
                                if code_match:
                                    diagnostic_code = f"{code_match.group(1)} ({code_match.group(2)})"
                                    break
                        
                        if diagnostic_code:
                            # Start new diagnostic item
                            current_item = {
                                'title': disorder_title,
                                'diagnostic_code': diagnostic_code,
                                'start_page': page_num,
                                'has_criteria': True,
                                'has_comorbidity': False,
                                'item_saved': False,
                                'end_page': page_num,
                                'comorbidity_page': None
                            }
                            current_text = [f"{disorder_title}\nDiagnostic Criteria\n{diagnostic_code}\n\n"]
                            logger.info(f"Found diagnostic item: {disorder_title} [{diagnostic_code}]")
                
                # Look for "Comorbidity" section (marks end of current disorder)
                if (current_item and 
                    not current_item.get('has_comorbidity', False) and
                    re.match(r'^Comorbidity\s*$', line, re.IGNORECASE)):
                    
                    # Mark that we found comorbidity heading
                    current_item['has_comorbidity'] = True
                    current_item['comorbidity_page'] = page_num
                    current_item['comorbidity_start_line'] = i
                    current_text.append(line)
                    logger.info(f"Found comorbidity section for: {current_item['title']} - collecting content")
                
                # If we're collecting text for an item (not yet saved), add this line
                elif current_item and not current_item.get('item_saved', False):
                    # Add line to current collection
                    if line.strip():
                        current_text.append(line)
                        current_item['end_page'] = page_num
                
                i += 1
        
        # Save the last item if it wasn't saved yet
        if current_item and not current_item.get('item_saved', False):
            current_item['end_page'] = page_num
            current_item['full_text'] = '\n'.join(current_text)
            diagnostic_items.append(current_item)
            logger.info(f"Saved final item: {current_item['title']}")
        
        # Filter items to only include complete diagnostic sections
        complete_items = []
        for item in diagnostic_items:
            if (item.get('has_criteria', False) and 
                item.get('has_comorbidity', False) and 
                item.get('diagnostic_code') and
                item.get('full_text')):
                complete_items.append(item)
        
        # Add standardized headers to each item for uniform structure
        for item in complete_items:
            item['full_text'] = self.add_standardized_headers(item['full_text'], item['title'])
                
        return complete_items
    
    def add_standardized_headers(self, text, disorder_title):
        """Add all standardized DSM-5 headers to ensure uniform structure"""
        # Define the standard order of sections
        standard_sections = [
            'Diagnostic Criteria',
            'Specifiers',
            'Diagnostic Features',
            'Associated Features Supporting Diagnosis',
            'Prevalence',
            'Development and Course',
            'Risk and Prognostic Factors',
            'Culture-Related Diagnostic Issues',
            'Gender-Related Diagnostic Issues',
            'Suicide Risk',
            f'Functional Consequences of {disorder_title}',
            'Differential Diagnosis',
            'Comorbidity'
        ]
        
        # Parse existing content into sections
        lines = text.split('\n')
        sections = {}
        current_section = None
        current_content = []
        
        for line in lines:
            line_stripped = line.strip()
            
            # Skip empty lines and disorder title (will be added by PDF generator)
            if not line_stripped or line_stripped == disorder_title:
                continue
            
            # Check if this line is a section header
            is_header = False
            for std_section in standard_sections:
                # Match section headers (case-insensitive, flexible spacing)
                # Handle "Functional Consequences of [Disorder]" variations
                if 'Functional Consequences' in std_section:
                    pattern = r'^Functional\s+Consequences'
                else:
                    pattern = re.escape(std_section).replace(r'\ ', r'\s+')
                
                if re.match(f'^{pattern}', line_stripped, re.IGNORECASE):
                    # Save previous section
                    if current_section:
                        sections[current_section] = '\n'.join(current_content).strip()
                    current_section = std_section
                    current_content = []
                    is_header = True
                    break
            
            if not is_header and current_section:
                current_content.append(line)
        
        # Save last section
        if current_section:
            sections[current_section] = '\n'.join(current_content).strip()
        
        # Build standardized output
        result = []
        for section in standard_sections:
            result.append(section)  # Add section header
            if section in sections and sections[section]:
                result.append(sections[section])  # Add content if exists
                result.append('')  # Add blank line after content
            else:
                result.append('[No data available for this section]')
                result.append('')  # Add blank line
        
        return '\n'.join(result)
    
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
        """Create a single-page PDF with multi-column layout to fit all content."""
        try:
            buffer = BytesIO()
            
            # Create PDF with letter size
            c = canvas.Canvas(buffer, pagesize=letter)
            width, height = letter
            
            # Set up margins (smaller for more space)
            margin = 0.25 * inch
            header_height = 0.4 * inch  # Space for title and code
            footer_height = 0.15 * inch  # Space for footer
            
            # Title and header
            c.setFont("Helvetica-Bold", 9)
            title = item['title'][:100]  # Limit title length
            c.drawString(margin, height - margin, title)
            
            c.setFont("Helvetica", 7)
            code_text = f"Code: {item['diagnostic_code']}"
            c.drawString(margin, height - margin - 0.15*inch, code_text)
            
            # Draw a line separator
            c.line(margin, height - margin - 0.25*inch, width - margin, height - margin - 0.25*inch)
            
            # Multi-column setup
            num_columns = 2  # Default to 2 columns
            column_gap = 0.15 * inch
            text_length = len(item.get('full_text', ''))
            
            # Use 3 columns for very long content
            if text_length > 100000:
                num_columns = 3
            
            # Calculate column dimensions
            total_column_width = width - (2 * margin)
            total_gap_width = column_gap * (num_columns - 1)
            column_width = (total_column_width - total_gap_width) / num_columns
            
            # Available height for content
            content_start_y = height - margin - header_height
            content_end_y = margin + footer_height
            column_height = content_start_y - content_end_y
            
            # Prepare text content with section headers
            text = item.get('full_text', '')
            processed_content = self.detect_section_headers(text)
            
            # Calculate font size based on content length
            if text_length < 2000:
                font_size = 5.5
                line_spacing = 6.5
                header_size = 6.5
            elif text_length < 5000:
                font_size = 4.5
                line_spacing = 5.5
                header_size = 5.5
            elif text_length < 10000:
                font_size = 4
                line_spacing = 5
                header_size = 5
            elif text_length < 30000:
                font_size = 3.5
                line_spacing = 4.5
                header_size = 4.5
            elif text_length < 60000:
                font_size = 3
                line_spacing = 4
                header_size = 4
            elif text_length < 100000:
                font_size = 2.8
                line_spacing = 3.5
                header_size = 3.5
            else:
                font_size = 2.5
                line_spacing = 3.2
                header_size = 3.2
            
            # Process content into formatted lines with type markers
            formatted_lines = []
            is_first_line = True
            disorder_name = item['title']
            
            for content_type, content_text in processed_content:
                # Check if this is the disorder name line (first text line)
                if is_first_line and content_type == 'TEXT' and content_text.strip() == disorder_name.strip():
                    # Mark disorder name as a special type to render in bold
                    formatted_lines.append(('DISORDER_NAME', content_text))
                    is_first_line = False
                elif content_type == 'HEADER':
                    # Add header as a single formatted line
                    formatted_lines.append(('HEADER', content_text))
                    is_first_line = False
                else:
                    # Split regular text into word-wrapped lines for column width
                    words = content_text.split()
                    current_line = ""
                    
                    for word in words:
                        test_line = current_line + " " + word if current_line else word
                        # Use column width for width calculation
                        test_width = c.stringWidth(test_line, "Helvetica", font_size)
                        if test_width < column_width - (0.05 * inch):  # Small padding
                            current_line = test_line
                        else:
                            if current_line:
                                formatted_lines.append(('TEXT', current_line))
                            current_line = word
                    
                    if current_line:
                        formatted_lines.append(('TEXT', current_line))
                    is_first_line = False
            
            # Draw content in columns
            header_spacing = line_spacing * 1.3
            current_column = 0
            x_position = margin
            y_position = content_start_y
            
            for line_type, line_text in formatted_lines:
                # Determine line height and spacing based on type
                if line_type in ['HEADER', 'DISORDER_NAME']:
                    line_height = header_spacing
                else:
                    line_height = line_spacing
                
                # Check if we need to move to next column
                if y_position - line_height < content_end_y:
                    current_column += 1
                    if current_column >= num_columns:
                        # No more space, stop drawing
                        logger.warning(f"Content too large for {num_columns} columns, some content may be truncated")
                        break
                    # Move to next column
                    x_position = margin + (current_column * (column_width + column_gap))
                    y_position = content_start_y
                
                # Draw the line with appropriate font
                if line_type == 'DISORDER_NAME':
                    # Disorder name in bold with slightly larger font
                    c.setFont("Helvetica-Bold", header_size)
                    c.drawString(x_position, y_position, line_text[:int(column_width/2)])
                elif line_type == 'HEADER':
                    # Section headers in bold
                    c.setFont("Helvetica-Bold", header_size)
                    c.drawString(x_position, y_position, line_text[:int(column_width/2)])
                else:
                    # Regular text
                    c.setFont("Helvetica", font_size)
                    c.drawString(x_position, y_position, line_text[:int(column_width/2)])
                
                y_position -= line_height
            
            # Draw column separators (optional visual guide)
            c.setStrokeColorRGB(0.8, 0.8, 0.8)
            c.setLineWidth(0.5)
            for col in range(1, num_columns):
                x_sep = margin + (col * (column_width + column_gap)) - (column_gap / 2)
                c.line(x_sep, content_start_y, x_sep, content_end_y)
            
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
