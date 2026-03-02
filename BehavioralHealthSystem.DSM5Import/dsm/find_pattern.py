import pdfplumber

# Find Cannabis Withdrawal diagnostic criteria page
pdf = pdfplumber.open('DSM5.pdf')

# Search through all pages
for i, page in enumerate(pdf.pages):
    text = page.extract_text()
    if 'Cannabis Withdrawal' in text:
        lines = text.split('\n')
        
        # Find all occurrences of Cannabis Withdrawal
        for j, line in enumerate(lines):
            if 'Cannabis Withdrawal' in line and line.strip() == 'Cannabis Withdrawal':
                print(f'\n=== PAGE {i+1}, Lines {j-2} to {j+15} ===\n')
                for k, l in enumerate(lines[max(0,j-2):min(len(lines),j+15)], start=max(0,j-2)):
                    marker = ' <-- Cannabis Withdrawal' if k == j else ''
                    print(f'{k:3d}: {l}{marker}')
