import fitz
import json

doc = fitz.open(r"C:\Users\pavan\Downloads\NH-Fee-Plazas-1.pdf")
text = ""
for page in doc:
    text += page.get_text("text") + "\n"

with open("scratch/pdf_text.txt", "w", encoding="utf-8") as f:
    f.write(text)
print("PDF text written to scratch/pdf_text.txt")
