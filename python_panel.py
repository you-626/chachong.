import tkinter as tk
from tkinter import messagebox, scrolledtext
import requests
import threading



class ImportPanel:
    def __init__(self, root):
        self.root = root
        self.root.title("账号采集批量导入工具 (支持垂直列表)")
        self.root.geometry("800x700")
        self.root.configure(bg="#f3f4f6")

        self.base_url = "http://localhost:3001"
        self.token = ""

        self.setup_ui()

    def setup_ui(self):
        config_frame = tk.LabelFrame(
            self.root,
            text=" 1. 服务器配置 ",
            padx=15,
            pady=10,
            bg="#f3f4f6",
            font=("Microsoft YaHei", 10, "bold")
        )
        config_frame.pack(fill="x", padx=20, pady=10)

        tk.Label(config_frame, text="地址:", bg="#f3f4f6").grid(row=0, column=0, sticky="w")
        self.url_entry = tk.Entry(config_frame, width=25)
        self.url_entry.insert(0, self.base_url)
        self.url_entry.grid(row=0, column=1, padx=5, pady=5)

        tk.Label(config_frame, text="管理员:", bg="#f3f4f6").grid(row=0, column=2, sticky="w")
        self.user_entry = tk.Entry(config_frame, width=15)
        self.user_entry.insert(0, "admin")
        self.user_entry.grid(row=0, column=3, padx=5, pady=5)

        tk.Label(config_frame, text="密码:", bg="#f3f4f6").grid(row=0, column=4, sticky="w")
        self.pass_entry = tk.Entry(config_frame, show="*", width=15)
        self.pass_entry.insert(0, "admin123")
        self.pass_entry.grid(row=0, column=5, padx=5, pady=5)

        self.login_btn = tk.Button(
            config_frame,
            text="连接并登录",
            command=self.login,
            bg="#4f46e5",
            fg="white",
            font=("Microsoft YaHei", 9)
        )
        self.login_btn.grid(row=0, column=6, padx=10, pady=5)

        # --- 中间：导入模式与数据 ---
        main_frame = tk.Frame(self.root, bg="#f3f4f6")
        main_frame.pack(fill="both", expand=True, padx=20, pady=5)

        # 模式选择
        mode_frame = tk.Frame(main_frame, bg="#f3f4f6")
        mode_frame.pack(fill="x", pady=5)

        tk.Label(
            mode_frame,
            text="解析模式:",
            bg="#f3f4f6",
            font=("Microsoft YaHei", 10, "bold")
        ).pack(side="left")

        self.mode_var = tk.StringVar(value="auto")

        tk.Radiobutton(
            mode_frame,
            text="智能/混合 (推荐)",
            variable=self.mode_var,
            value="auto",
            bg="#f3f4f6"
        ).pack(side="left", padx=10)

        tk.Radiobutton(
            mode_frame,
            text="首行为员工名",
            variable=self.mode_var,
            value="first_line",
            bg="#f3f4f6"
        ).pack(side="left", padx=10)

        # 说明
        tip_label = tk.Label(
            main_frame,
            text=(
                "格式说明：\n"
                "1. 混合模式：支持 '员工 账号'，也支持首行为员工名、下面为账号。\n"
                "2. 首行模式：将第一行作为员工名，之后所有行作为该员工的采集账号。"
            ),
            justify="left",
            fg="#6b7280",
            bg="#f3f4f6",
            font=("Microsoft YaHei", 9)
        )
        tip_label.pack(fill="x", pady=5)

        # 文本框
        self.text_area = scrolledtext.ScrolledText(
            main_frame,
            width=80,
            height=25,
            font=("Consolas", 10)
        )
        self.text_area.pack(fill="both", expand=True)
        self.text_area.insert(
            "1.0",
            "# 请粘贴数据，例如：\n"
            "罗佳\n"
            "kiki401803536\n"
            "xiaohan6923\n"
        )

        # --- 底部：统计与执行 ---
        bottom_frame = tk.Frame(self.root, bg="#f3f4f6")
        bottom_frame.pack(fill="x", padx=20, pady=15)

        self.status_label = tk.Label(
            bottom_frame,
            text="未连接",
            fg="red",
            bg="#f3f4f6",
            font=("Microsoft YaHei", 10)
        )
        self.status_label.pack(side="left")

        self.import_btn = tk.Button(
            bottom_frame,
            text="🚀 开始批量导入数据",
            command=self.start_import_thread,
            state=tk.DISABLED,
            bg="#10b981",
            fg="white",
            font=("Microsoft YaHei", 11, "bold"),
            padx=30,
            pady=8
        )
        self.import_btn.pack(side="right")

    def safe_json_response(self, resp):
        """
        安全解析 JSON。
        如果服务器返回 HTML、空内容、文本、404 页面等非 JSON 内容，
        不会直接报错，而是返回错误信息。
        """
        try:
            return resp.json(), None
        except ValueError:
            text = resp.text.strip()

            if not text:
                text = "服务器返回内容为空"

            error_msg = (
                "服务器返回的不是合法 JSON。\n\n"
                f"状态码: {resp.status_code}\n"
                f"Content-Type: {resp.headers.get('Content-Type', '未知')}\n\n"
                f"返回内容:\n{text[:800]}"
            )

            return None, error_msg

    def login(self):
        url = self.url_entry.get().strip().rstrip("/")
        username = self.user_entry.get().strip()
        password = self.pass_entry.get().strip()

        if not url:
            messagebox.showwarning("提示", "请输入服务器地址")
            return

        if not username or not password:
            messagebox.showwarning("提示", "请输入管理员账号和密码")
            return

        def task():
            try:
                self.root.after(
                    0,
                    lambda: self.login_btn.config(state=tk.DISABLED, text="连接中...")
                )

                resp = requests.post(
                    f"{url}/api/login",
                    json={
                        "username": username,
                        "password": password
                    },
                    timeout=5
                )

                # 调试信息：可以在终端看到服务器实际返回内容
                print("登录状态码:", resp.status_code)
                print("登录 Content-Type:", resp.headers.get("Content-Type"))
                print("登录返回内容:", resp.text)

                data, json_error = self.safe_json_response(resp)

                if json_error:
                    self.root.after(
                        0,
                        lambda err=json_error: messagebox.showerror("错误", err)
                    )
                    return

                if resp.status_code == 200:
                    token = data.get("token")

                    if not token:
                        self.root.after(
                            0,
                            lambda d=data: messagebox.showerror(
                                "错误",
                                f"登录接口返回成功，但没有返回 token。\n\n返回数据:\n{d}"
                            )
                        )
                        return

                    self.token = token
                    self.root.after(0, self.on_login_success)
                else:
                    msg = data.get("message", "登录失败")
                    self.root.after(
                        0,
                        lambda m=msg: messagebox.showerror("失败", m)
                    )

            except requests.exceptions.ConnectionError:
                self.root.after(
                    0,
                    lambda: messagebox.showerror(
                        "错误",
                        "无法连接服务器。\n\n"
                        "请检查：\n"
                        "1. 后端服务是否已经启动\n"
                        "2. 地址是否正确\n"
                        "3. 端口是否是 3001\n"
                        "4. 登录接口是否是 /api/login"
                    )
                )
            except requests.exceptions.Timeout:
                self.root.after(
                    0,
                    lambda: messagebox.showerror(
                        "错误",
                        "连接服务器超时，请检查后端服务是否正常运行。"
                    )
                )
            except Exception as e:
                self.root.after(
                    0,
                    lambda err=str(e): messagebox.showerror(
                        "错误",
                        f"连接服务器失败:\n{err}"
                    )
                )
            finally:
                self.root.after(
                    0,
                    lambda: self.login_btn.config(
                        state=tk.NORMAL,
                        text="连接并登录"
                    )
                )

        threading.Thread(target=task, daemon=True).start()

    def on_login_success(self):
        self.status_label.config(text="● 已连接 (管理员)", fg="#059669")
        self.import_btn.config(state=tk.NORMAL)
        messagebox.showinfo("提示", "服务器登录成功")

    def start_import_thread(self):
        if not self.token:
            messagebox.showwarning("提示", "请先连接并登录服务器")
            return

        content = self.text_area.get("1.0", tk.END).strip()

        lines = [
            line.strip()
            for line in content.split("\n")
            if line.strip() and not line.strip().startswith("#")
        ]

        if not lines:
            messagebox.showwarning("空数据", "请输入要导入的账号数据")
            return

        mode = self.mode_var.get()
        data_to_send = []

        if mode == "first_line":
            if len(lines) < 2:
                messagebox.showwarning(
                    "格式错误",
                    "首行模式下，第一行是员工名，第二行开始才是账号。"
                )
                return

            employee = lines[0]
            accounts = lines[1:]

            for acc in accounts:
                data_to_send.append({
                    "employee": employee,
                    "account": acc
                })

        else:
            # 自动/混合模式
            current_employee = None

            for line in lines:
                parts = line.split()

                if len(parts) >= 2:
                    # 支持格式：员工 账号
                    employee = parts[0]
                    account = parts[1]

                    data_to_send.append({
                        "employee": employee,
                        "account": account
                    })

                    current_employee = employee
                else:
                    # 单行内容
                    if current_employee is None:
                        # 第一条单行内容认为是员工名
                        current_employee = line
                    else:
                        # 后续单行内容认为是该员工的账号
                        data_to_send.append({
                            "employee": current_employee,
                            "account": line
                        })

        if not data_to_send:
            messagebox.showwarning("格式错误", "无法解析有效数据")
            return

        confirm = messagebox.askyesno(
            "确认",
            f"解析到 {len(data_to_send)} 条账号数据，确定要导入吗？"
        )

        if not confirm:
            return

        self.import_btn.config(state=tk.DISABLED, text="正在处理...")

        threading.Thread(
            target=self.do_import,
            args=(data_to_send,),
            daemon=True
        ).start()

    def do_import(self, data):
        url = self.url_entry.get().strip().rstrip("/")

        headers = {
            "Authorization": f"Bearer {self.token}"
        }

        try:
            resp = requests.post(
                f"{url}/api/import/batch-custom",
                json={
                    "data": data
                },
                headers=headers,
                timeout=60
            )

            # 调试信息：可以在终端看到服务器实际返回内容
            print("导入状态码:", resp.status_code)
            print("导入 Content-Type:", resp.headers.get("Content-Type"))
            print("导入返回内容:", resp.text)

            result, json_error = self.safe_json_response(resp)

            if json_error:
                self.root.after(
                    0,
                    lambda err=json_error: messagebox.showerror("错误", err)
                )
                return

            if resp.status_code == 200:
                total = result.get("total", len(data))
                inserted = result.get("inserted", 0)
                skipped = result.get("skipped", 0)
                errors = result.get("errors", [])

                msg = (
                    "导入完成！\n\n"
                    f"总数: {total}\n"
                    f"成功: {inserted}\n"
                    f"跳过: {skipped}"
                )

                if errors:
                    msg += "\n\n错误详情:\n" + "\n".join(errors[:5])

                    if len(errors) > 5:
                        msg += f"\n……还有 {len(errors) - 5} 条错误未显示"

                self.root.after(
                    0,
                    lambda m=msg: messagebox.showinfo("结果", m)
                )
            else:
                err = result.get("message", "导入失败，服务器未返回具体错误信息")
                self.root.after(
                    0,
                    lambda e=err: messagebox.showerror("失败", e)
                )

        except requests.exceptions.ConnectionError:
            self.root.after(
                0,
                lambda: messagebox.showerror(
                    "错误",
                    "无法连接服务器，请确认后端服务是否仍在运行。"
                )
            )
        except requests.exceptions.Timeout:
            self.root.after(
                0,
                lambda: messagebox.showerror(
                    "错误",
                    "导入请求超时，可能是数据较多或服务器处理较慢。"
                )
            )
        except Exception as e:
            self.root.after(
                0,
                lambda err=str(e): messagebox.showerror(
                    "错误",
                    f"导入失败:\n{err}"
                )
            )
        finally:
            self.root.after(
                0,
                lambda: self.import_btn.config(
                    state=tk.NORMAL,
                    text="🚀 开始批量导入数据"
                )
            )


if __name__ == "__main__":
    root = tk.Tk()
    app = ImportPanel(root)
    root.mainloop()