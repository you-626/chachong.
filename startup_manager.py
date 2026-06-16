import os
import sys
import subprocess
import shutil
import winreg
import time

def get_resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

def run_command(command, cwd=None):
    print(f"Executing: {command} in {cwd or 'current directory'}")
    try:
        process = subprocess.Popen(
            command,
            cwd=cwd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        for line in process.stdout:
            print(line, end='')
        process.wait()
        return process.returncode == 0
    except Exception as e:
        print(f"Error executing command: {e}")
        return False

def set_autostart():
    """Add the current executable to Windows Startup Registry."""
    try:
        # Get the path of the current executable
        if getattr(sys, 'frozen', False):
            # If running as an EXE
            app_path = os.path.realpath(sys.executable)
        else:
            # If running as a script
            app_path = os.path.realpath(sys.argv[0])
            # If it's a .py file, we might want to start it with python, 
            # but usually for the user we want the EXE.
        
        app_name = "ChecklistSystemStartup"
        
        key = winreg.HKEY_CURRENT_USER
        key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
        
        with winreg.OpenKey(key, key_path, 0, winreg.KEY_SET_VALUE) as registry_key:
            winreg.SetValueEx(registry_key, app_name, 0, winreg.REG_SZ, app_path)
        print(f"✅ Successfully set autostart for: {app_path}")
    except Exception as e:
        print(f"❌ Failed to set autostart: {e}")

def main():
    # 1. Determine project root
    # Assuming the EXE is placed in the project root
    if getattr(sys, 'frozen', False):
        root_dir = os.path.dirname(sys.executable)
    else:
        root_dir = os.path.dirname(os.path.abspath(__file__))
    
    os.chdir(root_dir)
    print(f"Project Root: {root_dir}")

    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")
    public_dir = os.path.join(root_dir, "public")

    # 2. Check for Node.js
    if not run_command("node -v"):
        print("❌ Node.js is not installed. Please install Node.js first.")
        input("Press Enter to exit...")
        return

    # 3. Backend Setup
    print("\n--- Checking Backend ---")
    if not os.path.exists(os.path.join(backend_dir, "node_modules")):
        print("Installing backend dependencies...")
        run_command("npm install", cwd=backend_dir)
    else:
        print("Backend dependencies already installed.")

    # 4. Frontend Setup
    print("\n--- Checking Frontend ---")
    # We check for 'dist' folder. If it doesn't exist, we build.
    # Also check node_modules in frontend.
    if not os.path.exists(os.path.join(frontend_dir, "node_modules")):
        print("Installing frontend dependencies...")
        run_command("npm install", cwd=frontend_dir)
    
    if not os.path.exists(os.path.join(frontend_dir, "dist")):
        print("Building frontend...")
        run_command("npm run build", cwd=frontend_dir)
    else:
        print("Frontend already built.")

    # 5. Prepare Public Folder (for server.js)
    print("\n--- Preparing Static Files ---")
    dist_dir = os.path.join(frontend_dir, "dist")
    if os.path.exists(dist_dir):
        if os.path.exists(public_dir):
            # Optional: check if we should update public
            # For simplicity, we just ensure it exists
            pass
        else:
            print(f"Copying {dist_dir} to {public_dir}...")
            shutil.copytree(dist_dir, public_dir)
    else:
        print("⚠️ Warning: frontend/dist not found. Frontend might not be served.")

    # 6. Set Autostart
    set_autostart()

    # 7. Start Backend Server
    print("\n--- Starting System ---")
    print("The system will be available at http://localhost:3001")
    print("Close this window to stop the server.")
    
    # We use subprocess.run so the window stays open to show logs
    # or we can use Popen if we want to do something else.
    # But for a startup script, staying open is good for debugging.
    run_command("node server.js", cwd=backend_dir)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopping...")
    except Exception as e:
        print(f"\nAn error occurred: {e}")
        input("Press Enter to exit...")
