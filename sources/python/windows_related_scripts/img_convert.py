import os
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from PIL import Image
import threading

class ImageConverterApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Quick Image Converter")
        self.root.geometry("400x350")
        self.root.configure(bg="#111")
        
        tk.Label(root, text="Image Converter", font=("Segoe UI", 16, "bold"), bg="#111", fg="white").pack(pady=20)
        
        # Format selection
        tk.Label(root, text="Target Format:", bg="#111", fg="#aaa").pack()
        self.format_var = tk.StringVar(value="PNG")
        fmt_frame = tk.Frame(root, bg="#111")
        fmt_frame.pack(pady=10)
        
        for fmt in ["PNG", "JPG", "WEBP", "ICO"]:
            tk.Radiobutton(fmt_frame, text=fmt, variable=self.format_var, value=fmt, bg="#111", fg="white", selectcolor="#222").pack(side="left", padx=10)
            
        # Select Button
        tk.Button(root, text="SELECT IMAGES", command=self.select_files, bg="#00ff9d", fg="black", font=("Segoe UI", 12, "bold"), padx=20, pady=10).pack(pady=20)
        
        self.status_label = tk.Label(root, text="Ready", bg="#111", fg="#888")
        self.status_label.pack(pady=10)
        
        tk.Label(root, text="Files are saved in 'Converted' folder", bg="#111", fg="#555", font=("Consolas", 8)).pack(side="bottom", pady=10)

    def select_files(self):
        files = filedialog.askopenfilenames(filetypes=[("Images", "*.png;*.jpg;*.jpeg;*.webp;*.bmp;*.tiff")])
        if files:
            threading.Thread(target=self.convert_files, args=(files,), daemon=True).start()

    def convert_files(self, files):
        target_fmt = self.format_var.get().lower()
        if target_fmt == "jpg": target_fmt = "jpeg"
        
        success = 0
        total = len(files)
        
        for i, filepath in enumerate(files):
            try:
                self.status_label.config(text=f"Converting {i+1}/{total}: {os.path.basename(filepath)}", fg="#00bfff")
                
                img = Image.open(filepath)
                
                # Setup output path
                directory = os.path.dirname(filepath)
                out_dir = os.path.join(directory, "Converted")
                if not os.path.exists(out_dir): os.makedirs(out_dir)
                
                name = os.path.splitext(os.path.basename(filepath))[0]
                out_path = os.path.join(out_dir, f"{name}.{target_fmt}")
                
                # Convert
                if target_fmt == "jpeg" or target_fmt == "bmp":
                    img = img.convert("RGB")
                    
                if target_fmt == "ico":
                     img.save(out_path, sizes=[(256, 256)])
                else:
                    img.save(out_path)
                    
                success += 1
            except Exception as e:
                print(f"Error: {e}")
        
        self.status_label.config(text=f"Done! Converted {success}/{total} images.", fg="#00ff9d")
        messagebox.showinfo("Complete", f"Converted {success} images to {target_fmt.upper()}.\nSaved in 'Converted' folder.")

if __name__ == "__main__":
    root = tk.Tk()
    app = ImageConverterApp(root)
    root.mainloop()
