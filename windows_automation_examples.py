"""
Windows AI Automation Examples
Comprehensive examples for AI-controlled Windows automation
"""

import asyncio
import subprocess
import psutil
import pyautogui
import cv2
import numpy as np
from pywinauto.application import Application
from playwright.async_api import async_playwright
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class WindowsAutomationAgent:
    """Unified Windows automation agent for AI control"""
    
    def __init__(self):
        self.pyautogui.FAILSAFE = True  # Move mouse to corner to stop
        self.process_manager = ProcessManager()
        self.vision_system = VisionController()
        
    async def initialize(self):
        """Initialize all automation backends"""
        logger.info("Initializing Windows Automation Agent...")
        await self.process_manager.initialize()
        self.vision_system.initialize()
        
    async def execute_task(self, task_description: str):
        """Main AI task execution loop"""
        logger.info(f"Executing task: {task_description}")
        
        # Example task execution with different backends
        if "browser" in task_description.lower():
            return await self._browser_automation(task_description)
        elif "application" in task_description.lower():
            return await self._application_automation(task_description)
        elif "process" in task_description.lower():
            return await self._process_automation(task_description)
        elif "vision" in task_description.lower():
            return await self._vision_automation(task_description)
        else:
            return await self._unified_automation(task_description)
    
    async def _browser_automation(self, task: str):
        """Browser automation using Playwright"""
        logger.info("Starting browser automation...")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False)
            context = await browser.new_context(
                viewport={"width": 1280, "height": 720},
                record_video_dir="./automation_videos"
            )
            page = await context.new_page()
            
            # Example: Navigate and interact
            await page.goto("https://example.com")
            await page.screenshot(path="screenshot.png")
            
            # AI decision loop placeholder
            for step in range(5):
                screenshot = await page.screenshot()
                acc_tree = await page.accessibility.snapshot()
                
                # Here you would integrate with an LLM to decide actions
                action = await self._get_ai_action(screenshot, acc_tree, task)
                
                if action["type"] == "click":
                    await page.click(action["selector"])
                elif action["type"] == "type":
                    await page.type(action["selector"], action["text"])
                elif action["type"] == "done":
                    break
                    
                await asyncio.sleep(1)  # Small delay for demo
            
            await browser.close()
            return {"status": "completed", "actions": "browser automation executed"}
    
    async def _application_automation(self, task: str):
        """Windows application automation using PyWinAuto"""
        logger.info("Starting application automation...")
        
        try:
            # Launch Notepad as example
            app = Application(backend="uia").start("notepad.exe")
            
            # Wait for application to be ready
            app.UntitledNotepad.wait('ready', timeout=10)
            
            # Type text
            app.UntitledNotepad.type_keys("Hello from AI Automation!{ENTER}")
            app.UntitledNotepad.type_keys("This is automated text input.{ENTER}")
            
            # Menu interaction
            app.UntitledNotepad.menu_select("File->Save As")
            
            # Wait for Save As dialog
            app.SaveAs.wait('ready', timeout=5)
            
            # Set file name and save
            app.SaveAs.Edit.set_text("ai_automated_file.txt")
            app.SaveAs.Save.click()
            
            # Wait for save to complete
            time.sleep(2)
            
            return {"status": "completed", "actions": "notepad automation executed"}
            
        except Exception as e:
            logger.error(f"Application automation failed: {e}")
            return {"status": "failed", "error": str(e)}
    
    async def _process_automation(self, task: str):
        """Process management and automation"""
        logger.info("Starting process automation...")
        
        try:
            # Launch a process
            process_info = await self.process_manager.launch_process("calc.exe")
            logger.info(f"Launched calculator with PID: {process_info.pid}")
            
            # Monitor process
            for _ in range(5):
                status = await self.process_manager.check_process(process_info.pid)
                logger.info(f"Process status: {status}")
                await asyncio.sleep(1)
            
            # Terminate process
            await self.process_manager.terminate_process(process_info.pid)
            logger.info("Process terminated")
            
            return {"status": "completed", "actions": "process automation executed"}
            
        except Exception as e:
            logger.error(f"Process automation failed: {e}")
            return {"status": "failed", "error": str(e)}
    
    async def _vision_automation(self, task: str):
        """Computer vision-based automation"""
        logger.info("Starting vision automation...")
        
        try:
            # Take screenshot
            screenshot = pyautogui.screenshot()
            screenshot.save("current_screen.png")
            
            # Look for a specific element (example: Windows Start button)
            # You would need to have reference images for this to work
            start_button_location = self.vision_system.find_element("start_button.png", confidence=0.8)
            
            if start_button_location:
                x, y = start_button_location
                logger.info(f"Found Start button at ({x}, {y})")
                
                # Click on the found element
                pyautogui.click(x, y)
                await asyncio.sleep(2)
                
                # Press ESC to close Start menu
                pyautogui.press('esc')
                
                return {"status": "completed", "actions": "vision automation executed"}
            else:
                return {"status": "completed", "actions": "no target element found"}
                
        except Exception as e:
            logger.error(f"Vision automation failed: {e}")
            return {"status": "failed", "error": str(e)}
    
    async def _unified_automation(self, task: str):
        """Combine multiple automation methods"""
        logger.info("Starting unified automation...")
        
        results = []
        
        # Combine all methods
        results.append(await self._browser_automation(task))
        await asyncio.sleep(2)
        
        results.append(await self._application_automation(task))
        await asyncio.sleep(2)
        
        results.append(await self._vision_automation(task))
        
        return {"status": "completed", "results": results}
    
    async def _get_ai_action(self, screenshot, accessibility_tree, task):
        """Placeholder for AI decision making"""
        # In a real implementation, this would call an LLM
        # For demo purposes, return a simple action
        return {
            "type": "done",
            "selector": None,
            "text": None
        }


class ProcessManager:
    """Manages Windows processes for automation"""
    
    async def initialize(self):
        logger.info("Initializing Process Manager...")
    
    async def launch_process(self, executable: str, args=None):
        """Launch a Windows process"""
        try:
            if args:
                process = subprocess.Popen([executable] + args)
            else:
                process = subprocess.Popen([executable])
            
            logger.info(f"Launched {executable} with PID: {process.pid}")
            return process
            
        except Exception as e:
            logger.error(f"Failed to launch {executable}: {e}")
            raise
    
    async def check_process(self, pid: int):
        """Check if process is running"""
        try:
            process = psutil.Process(pid)
            return {
                "running": process.is_running(),
                "cpu_percent": process.cpu_percent(),
                "memory_mb": process.memory_info().rss / 1024 / 1024
            }
        except psutil.NoSuchProcess:
            return {"running": False}
    
    async def terminate_process(self, pid: int):
        """Terminate a process"""
        try:
            process = psutil.Process(pid)
            process.terminate()
            process.wait(timeout=5)
            logger.info(f"Terminated process {pid}")
        except Exception as e:
            logger.error(f"Failed to terminate process {pid}: {e}")
            raise
    
    async def list_processes(self, name_filter=None):
        """List running processes"""
        processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent']):
            try:
                if name_filter is None or name_filter.lower() in proc.info['name'].lower():
                    processes.append(proc.info)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        return processes


class VisionController:
    """Computer vision-based UI automation"""
    
    def initialize(self):
        logger.info("Initializing Vision Controller...")
        # Disable PyAutoGUI failsafe for production (re-enable for safety)
        pyautogui.FAILSAFE = True
    
    def find_element(self, reference_image_path: str, confidence: float = 0.9):
        """Find UI element using template matching"""
        try:
            # Take current screenshot
            screen = pyautogui.screenshot()
            screen_cv = cv2.cvtColor(np.array(screen), cv2.COLOR_RGB2BGR)
            
            # Load reference image
            template = cv2.imread(reference_image_path)
            if template is None:
                logger.error(f"Could not load reference image: {reference_image_path}")
                return None
            
            # Template matching
            result = cv2.matchTemplate(screen_cv, template, cv2.TM_CCOEFF_NORMED)
            min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)
            
            if max_val >= confidence:
                # Get center of matched region
                h, w = template.shape[:2]
                center_x = max_loc[0] + w // 2
                center_y = max_loc[1] + h // 2
                
                logger.info(f"Found element at ({center_x}, {center_y}) with confidence {max_val:.2f}")
                return (center_x, center_y)
            else:
                logger.info(f"No match found (best confidence: {max_val:.2f})")
                return None
                
        except Exception as e:
            logger.error(f"Vision detection failed: {e}")
            return None
    
    def click_element(self, reference_image_path: str, confidence: float = 0.9):
        """Find and click an element"""
        location = self.find_element(reference_image_path, confidence)
        if location:
            x, y = location
            pyautogui.click(x, y)
            return True
        return False
    
    def type_at_element(self, reference_image_path: str, text: str, confidence: float = 0.9):
        """Find element and type text at its location"""
        location = self.find_element(reference_image_path, confidence)
        if location:
            x, y = location
            pyautogui.click(x, y)
            pyautogui.typewrite(text)
            return True
        return False


# Example usage and testing
async def main():
    """Main function to demonstrate Windows automation capabilities"""
    
    # Initialize the automation agent
    agent = WindowsAutomationAgent()
    await agent.initialize()
    
    # Example tasks
    tasks = [
        "Open browser and navigate to website",
        "Launch and automate Windows application",
        "Manage Windows processes",
        "Use computer vision to interact with UI",
        "Unified automation demonstration"
    ]
    
    for task in tasks:
        logger.info(f"\n{'='*50}")
        logger.info(f"Executing: {task}")
        logger.info(f"{'='*50}")
        
        result = await agent.execute_task(task)
        logger.info(f"Result: {result}")
        
        # Wait between tasks
        await asyncio.sleep(3)
    
    logger.info("Automation demonstration completed!")


if __name__ == "__main__":
    # Run the demonstration
    asyncio.run(main())
