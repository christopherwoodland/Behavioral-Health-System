#!/usr/bin/env python3
"""
DSM5 PDF Splitter

This script splits the DSM5.pdf file into multiple PDF files, each containing 25 pages.
The output files are named with the format: dsm5-page#-page#.pdf

Requirements:
    pip install PyPDF2

Usage:
    python split_dsm5.py
"""

import os
from PyPDF2 import PdfReader, PdfWriter


def split_pdf(input_file, pages_per_split=60:
    """
    Split a PDF file into multiple files with specified number of pages each.
    
    Args:
        input_file (str): Path to the input PDF file
        pages_per_split (int): Number of pages per output file (default: 25)
    """
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"Error: Input file '{input_file}' not found.")
        return
    
    try:
        # Read the input PDF
        reader = PdfReader(input_file)
        total_pages = len(reader.pages)
        
        print(f"Total pages in {input_file}: {total_pages}")
        print(f"Splitting into files with {pages_per_split} pages each...")
        
        # Calculate number of output files needed
        num_files = (total_pages + pages_per_split - 1) // pages_per_split  # Ceiling division
        
        for file_num in range(num_files):
            # Calculate page range for this file
            start_page = file_num * pages_per_split
            end_page = min(start_page + pages_per_split - 1, total_pages - 1)
            
            # Create output filename
            output_filename = f"dsm5-page{start_page + 1}-page{end_page + 1}.pdf"
            
            # Create a new PDF writer
            writer = PdfWriter()
            
            # Add pages to the writer
            for page_num in range(start_page, end_page + 1):
                writer.add_page(reader.pages[page_num])
            
            # Write the output file
            with open(output_filename, 'wb') as output_file:
                writer.write(output_file)
            
            print(f"Created: {output_filename} (pages {start_page + 1}-{end_page + 1})")
        
        print(f"\nSplitting complete! Created {num_files} files.")
        
    except Exception as e:
        print(f"Error processing PDF: {str(e)}")
        print("Make sure you have PyPDF2 installed: pip install PyPDF2")


def main():
    """Main function to run the PDF splitter."""
    input_file = "DSM5.pdf"
    
    print("DSM5 PDF Splitter")
    print("=================")
    
    # Split the PDF
    split_pdf(input_file, pages_per_split=25)


if __name__ == "__main__":
    main()