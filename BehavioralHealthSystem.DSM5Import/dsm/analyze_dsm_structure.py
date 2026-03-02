#!/usr/bin/env python3
"""
DSM5 PDF Structure Analyzer

This script analyzes the DSM5.pdf to understand the structure of diagnostic sections.
"""

import pdfplumber
import re
import os

def analyze_dsm_structure(pdf_path, num_pages=50):
    """Analyze the first few pages to understand the structure."""
    
    if not os.path.exists(pdf_path):
        print(f"Error: {pdf_path} not found")
        return
    
    print("Analyzing DSM5.pdf structure...")
    print("=" * 50)
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_num in range(min(num_pages, len(pdf.pages))):
                page = pdf.pages[page_num]
                text = page.extract_text()
                
                if not text:
                    continue
                
                lines = text.split('\n')
                
                print(f"\n--- PAGE {page_num + 1} ---")
                
                for line_num, line in enumerate(lines):
                    line = line.strip()
                    
                    # Look for potential diagnostic codes
                    code_pattern = r'\b\d{3}\.\d+\s*\([A-Z]\d+[\.\d]*\)'
                    if re.search(code_pattern, line):
                        print(f"DIAGNOSTIC CODE: {line}")
                    
                    # Look for "Diagnostic Criteria"
                    if re.search(r'(?i)diagnostic\s+criteria', line):
                        print(f"DIAGNOSTIC CRITERIA: {line}")
                        # Show context around this line
                        start = max(0, line_num - 2)
                        end = min(len(lines), line_num + 3)
                        for i in range(start, end):
                            marker = ">>> " if i == line_num else "    "
                            print(f"{marker}{lines[i].strip()}")
                        print()
                    
                    # Look for "Comorbidity"
                    if re.search(r'(?i)comorbidity', line):
                        print(f"COMORBIDITY: {line}")
                        # Show context around this line
                        start = max(0, line_num - 2)
                        end = min(len(lines), line_num + 3)
                        for i in range(start, end):
                            marker = ">>> " if i == line_num else "    "
                            print(f"{marker}{lines[i].strip()}")
                        print()
                    
                    # Look for disorder names (titles that might be headers)
                    if (len(line) > 10 and len(line) < 100 and 
                        ('disorder' in line.lower() or 'syndrome' in line.lower() or 
                         'episode' in line.lower() or 'condition' in line.lower())):
                        # Check if it looks like a title (not part of a sentence)
                        if (line[0].isupper() and not line.endswith('.') and 
                            not line.startswith('•') and not line.startswith('-')):
                            print(f"POTENTIAL DISORDER TITLE: {line}")
                
                # Stop if we've seen enough patterns
                if page_num > 20:
                    break
                    
    except Exception as e:
        print(f"Error analyzing PDF: {e}")

if __name__ == "__main__":
    analyze_dsm_structure("DSM5.pdf")