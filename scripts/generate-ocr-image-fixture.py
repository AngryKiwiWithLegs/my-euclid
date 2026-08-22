from PIL import Image, ImageDraw, ImageFont

output_path = "/tmp/euclid-ocr-sample.png"
image = Image.new("RGB", (1600, 600), "white")
draw = ImageDraw.Draw(image)
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 54)
draw.text((90, 110), "Euclid invariant verification", fill="black", font=font)
draw.text((90, 230), "Question 1. Find and prove the invariant.", fill="black", font=font)
image.save(output_path)
print(output_path)
