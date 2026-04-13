import os
import shutil
import tkinter as tk
from tkinter import messagebox
from datetime import datetime

class DesktopOrganizer:
    def __init__(self):
        self.desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        self.mapping = {
            "Images": ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'],
            "Docs": ['.txt', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.md'],
            "Archives": ['.zip', '.rar', '.7z', '.tar', '.gz'],
            "Code": ['.py', '.js', '.ts', '.tsx', '.html', '.css', '.json', '.rs', '.go', '.cpp', '.h'],
            "Installers": ['.exe', '.msi'],
            "3D": ['.obj', '.fbx', '.gltf', '.glb', '.blend', '.stl']
        }

    def organize(self):
        count = 0
        moved = []
        
        root = tk.Tk()
        root.withdraw()
        
        if not messagebox.askyesno("Clean Desktop", "Are you sure you want to organize your Desktop?\nThis will move loose files into categorized folders."):
            return

        for filename in os.listdir(self.desktop):
            path = os.path.join(self.desktop, filename)
            
            # Skip folders and shortcuts
            if os.path.isdir(path) or filename.endswith('.lnk') or filename == "desktop.ini":
                continue
                
            # Skip self
            if "organize_desktop" in filename:
                continue

            _, ext = os.path.splitext(filename)
            ext = ext.lower()
            
            target_folder = None
            for folder, exts in self.mapping.items():
                if ext in exts:
                    target_folder = folder
                    break
            
            if target_folder:
                dest_dir = os.path.join(self.desktop, target_folder)
                if not os.path.exists(dest_dir):
                    os.makedirs(dest_dir)
                
                try:
                    shutil.move(path, os.path.join(dest_dir, filename))
                    count += 1
                    moved.append(filename)
                except Exception as e:
                    print(f"Error moving {filename}: {e}")

        if count > 0:
            summary = "\n".join(moved[:5])
            if count > 5: summary += f"\n...and {count-5} others"
            messagebox.showinfo("Desktop Organized", f"Moved {count} files:\n\n{summary}")
        else:
            messagebox.showinfo("Clean", "Desktop is already clean!")

if __name__ == "__main__":
    app = DesktopOrganizer()
    app.organize()
