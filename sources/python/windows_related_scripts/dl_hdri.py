import os
import json
import threading
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import urllib.request
import urllib.parse
from PIL import Image, ImageTk
import io

# Poly Haven API
API_URL = "https://api.polyhaven.com/assets?t=hdris"

class HDRI_Downloader:
    def __init__(self, root):
        self.root = root
        self.root.title("Poly Haven HDRI Downloader")
        self.root.geometry("800x600")
        self.root.configure(bg="#111")
        
        self.assets = {}
        self.filtered_assets = []
        
        # UI
        top_frame = tk.Frame(root, bg="#1a1a1a", pady=10)
        top_frame.pack(fill="x")
        
        tk.Label(top_frame, text="🔍 Search:", fg="white", bg="#1a1a1a").pack(side="left", padx=10)
        self.search_var = tk.StringVar()
        self.search_var.trace("w", self.filter_list)
        tk.Entry(top_frame, textvariable=self.search_var, bg="#222", fg="white", insertbackground="white").pack(side="left", fill="x", expand=True, padx=10)
        
        self.tree = ttk.Treeview(root, columns=("Name", "Categories"), show="headings")
        self.tree.heading("Name", text="Name")
        self.tree.heading("Categories", text="Tags")
        self.tree.column("Name", width=200)
        self.tree.pack(fill="both", expand=True, padx=10, pady=10)
        self.tree.bind("<Double-1>", self.download_selected)
        
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("Treeview", background="#222", foreground="white", fieldbackground="#222", rowheight=25)
        style.map("Treeview", background=[('selected', '#00ff9d')])
        
        btn_frame = tk.Frame(root, bg="#111", pady=10)
        btn_frame.pack(fill="x")
        
        tk.Button(btn_frame, text="DOWNLOAD 4K EXR", command=self.download_selected, bg="#00ff9d", fg="black", font=("Arial", 10, "bold"), padx=20).pack()
        
        self.status_label = tk.Label(root, text="Ready", bg="#111", fg="#888")
        self.status_label.pack(pady=5)
        
        threading.Thread(target=self.fetch_assets, daemon=True).start()

    def fetch_assets(self):
        try:
            self.status_label.config(text="Fetching asset list...")
            with urllib.request.urlopen(API_URL) as response:
                data = json.loads(response.read().decode())
                self.assets = data
                self.filtered_assets = list(self.assets.keys())
                self.populate_tree()
                self.status_label.config(text=f"Found {len(self.assets)} HDRIs")
        except Exception as e:
            self.status_label.config(text=f"Error: {e}")

    def filter_list(self, *args):
        query = self.search_var.get().lower()
        self.filtered_assets = [k for k in self.assets.keys() if query in k.lower()]
        self.populate_tree()

    def populate_tree(self):
        self.tree.delete(*self.tree.get_children())
        for k in self.filtered_assets[:100]: # Limit for perf
            cats = ", ".join(self.assets[k].get("categories", []))
            self.tree.insert("", "end", values=(k, cats))

    def download_selected(self, event=None):
        sel = self.tree.selection()
        if not sel: return
        
        item = self.tree.item(sel[0])
        asset_id = item['values'][0]
        
        # Default to 4k EXR
        url = f"https://dl.polyhaven.org/file/ph-assets/HDRIs/exr/4k/{asset_id}_4k.exr"
        dest_dir = os.path.join(os.path.expanduser("~"), "Desktop", "HDRIs")
        if not os.path.exists(dest_dir): os.makedirs(dest_dir)
        
        dest_path = os.path.join(dest_dir, f"{asset_id}_4k.exr")
        
        threading.Thread(target=self.download_file, args=(url, dest_path), daemon=True).start()

    def download_file(self, url, dest):
        try:
            self.status_label.config(text=f"Downloading {os.path.basename(dest)}...", fg="#00bfff")
            urllib.request.urlretrieve(url, dest)
            self.status_label.config(text=f"✓ Saved to Desktop/HDRIs/{os.path.basename(dest)}", fg="#00ff9d")
            messagebox.showinfo("Download Complete", f"Saved to:\n{dest}")
        except Exception as e:
            self.status_label.config(text=f"Error: {e}", fg="#ff6b6b")

if __name__ == "__main__":
    root = tk.Tk()
    app = HDRI_Downloader(root)
    root.mainloop()
