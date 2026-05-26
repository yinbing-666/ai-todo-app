"use client";

import { useState, useEffect } from "react";
import { Check, Circle, Plus, Trash2, Pencil, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { signOutAction } from "./actions";
import { useRouter } from "next/navigation";

type Todo = {
  id: number;
  text: string;
  completed: boolean;
  old: {
    id: number;
  };
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  image_url?: string;
};

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // 检查用户登录状态并加载用户的todos
  useEffect(() => {
    const checkUserAndLoadTodos = async () => {
      try {
        // 获取用户会话
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const currentUser = session?.user || null;
        setUser(currentUser);
        setIsLoggedIn(!!currentUser);

        // 如果用户已登录，加载他们的todos
        if (currentUser) {
          await fetchTodos();
        }
      } catch (error) {
        console.error("Error checking user or loading todos:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkUserAndLoadTodos();
  }, []);

  // 设置 Realtime 订阅，当用户状态变化时重新订阅
  useEffect(() => {
    let channel: any = null;

    if (user) {
      // 设置 Realtime 订阅
      channel = setupRealtimeSubscription();
    }

    // 组件卸载或用户变化时清理订阅
    return () => {
      if (channel) {
        console.log("Unsubscribing from Realtime channel");
        channel.unsubscribe();
      }
    };
  }, [user]);

  // 设置 Realtime 订阅
  const setupRealtimeSubscription = () => {
    if (!user) return;

    console.log("Setting up Realtime subscription for user:", user.id);

    // 创建一个 Supabase Realtime 频道并订阅 todos 表的变化
    const channel = supabase
      .channel(`todos-channel-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*", // 监听所有事件类型 (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "todos",
          filter: `user_id=eq.${user.id}`, // 只监听当前用户的 todos
        },
        (payload) => {
          console.log("Realtime change received:", payload);

          // 根据事件类型处理不同的数据变化
          if (payload.eventType === "INSERT") {
            // 新增 todo
            const newTodo = payload.new as Todo;
            // 只有当新增的todo是当前用户的时才添加到列表
            if (newTodo.user_id === user.id) {
              setTodos((currentTodos) => {
                // 检查是否已经存在相同ID的todo，避免重复添加
                const exists = currentTodos.some(
                  (todo) => todo.id === newTodo.id
                );
                if (exists) {
                  return currentTodos;
                }
                // 将新todo添加到列表开头
                return [newTodo, ...currentTodos];
              });
            }
          } else if (payload.eventType === "UPDATE") {
            // 更新 todo
            const updatedTodo = payload.new as Todo;
            // 只有当更新的todo是当前用户的时才更新列表
            if (updatedTodo.user_id === user.id) {
              setTodos((currentTodos) =>
                currentTodos.map((todo) =>
                  todo.id === updatedTodo.id ? updatedTodo : todo
                )
              );
            }
          } else if (payload.eventType === "DELETE") {
            // 删除 todo
            const deletedTodo = payload.old as Todo;
            // 只有当删除的todo是当前用户的时才从列表中移除
            setTodos((currentTodos) =>
              currentTodos.filter((todo) => todo.id !== deletedTodo.id)
            );
          }
        }
      )
      .subscribe((status) => {
        console.log("Realtime subscription status:", status);
      });

    return channel;
  };

  // 获取用户的todos
  const fetchTodos = async () => {
    try {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      if (data) {
        setTodos(data);
      }
    } catch (error) {
      console.error("Error fetching todos:", error);
    }
  };

  // 处理图片选择
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith("image/")) {
      alert("请选择图片文件");
      return;
    }

    // 检查文件大小 (限制为 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("图片大小不能超过 5MB");
      return;
    }

    setSelectedImage(file);

    // 创建预览
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 清除选择的图片
  const clearSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setUploadProgress(0);
  };

  // 上传图片到 Supabase Storage
  const uploadImage = async (userId: string): Promise<string | null> => {
    if (!selectedImage) return null;

    try {
      // 创建文件路径: uid/timestamp-filename
      const fileExt = selectedImage.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // 上传文件到 my-todo bucket
      const { data, error } = await supabase.storage
        .from("my-todo")
        .upload(filePath, selectedImage, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        throw error;
      }

      // 获取公共 URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("my-todo").getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      return null;
    }
  };

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 如果用户未登录，重定向到登录页面
    if (!user) {
      router.push("/sign-in");
      return;
    }
    
    // 必须有文本或图片才能提交
    if ((!newTodo.trim() && !selectedImage) || isSubmitting) {
      if (!newTodo.trim() && !selectedImage) {
        setApiError("请输入文本或上传图片");
      }
      return;
    }
    
    try {
      setIsSubmitting(true);
      setApiError(null);
      
      // 设置上传进度初始值
      if (selectedImage) {
        setUploadProgress(10);
      }
      
      // 如果有图片，先上传图片
      let imageUrl = null;
      if (selectedImage) {
        // 模拟上传进度
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + 10;
          });
        }, 300);
        
        imageUrl = await uploadImage(user.id);
        
        // 清除进度间隔
        clearInterval(progressInterval);
        
        // 设置上传完成
        setUploadProgress(100);
        
        if (!imageUrl) {
          throw new Error("图片上传失败");
        }
      }
      
      // 调用后端API解析文本和创建待办事项
      const response = await fetch('/api/parse-todos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: newTodo.trim() || null, // 允许为空，由图片处理
          userId: user.id,
          imageUrl: imageUrl,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || '创建待办事项失败');
      }
      
      // 清空输入框和图片
      setNewTodo("");
      clearSelectedImage();

      // 重新拉取todo列表（Realtime可能不工作）
      await fetchTodos();
      
    } catch (error: any) {
      console.error("Error adding todo:", error);
      setApiError(error.message || "添加任务失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTodo = async (id: number) => {
    // 如果用户未登录，重定向到登录页面
    if (!user) {
      router.push("/sign-in");
      return;
    }

    try {
      // 找到要更新的todo
      const todoToUpdate = todos.find((todo) => todo.id === id);
      if (!todoToUpdate) return;

      // 更新Supabase
      const { error } = await supabase
        .from("todos")
        .update({ completed: !todoToUpdate.completed })
        .eq("id", id);

      if (error) {
        throw error;
      }

      // 不再手动更新本地状态，由 Realtime 订阅处理
    } catch (error) {
      console.error("Error toggling todo:", error);
    }
  };

  const deleteTodo = async (id: number) => {
    // 如果用户未登录，重定向到登录页面
    if (!user) {
      router.push("/sign-in");
      return;
    }

    try {
      // 从Supabase删除
      const { error } = await supabase.from("todos").delete().eq("id", id);

      if (error) {
        throw error;
      }

      // 不再手动更新本地状态，由 Realtime 订阅处理
    } catch (error) {
      console.error("Error deleting todo:", error);
    }
  };

  const startEditing = (todo: Todo) => {
    // 如果用户未登录，重定向到登录页面
    if (!user) {
      router.push("/sign-in");
      return;
    }

    setEditingId(todo.id);
    setEditText(todo.text);
  };

  const saveEdit = async () => {
    if (!user) {
      router.push("/sign-in");
      return;
    }

    if (editText.trim() && editingId && !isSubmitting) {
      try {
        setIsSubmitting(true);

        // 更新Supabase
        const { error } = await supabase
          .from("todos")
          .update({ text: editText.trim() })
          .eq("id", editingId);

        if (error) {
          throw error;
        }

        // 不再手动更新本地状态，由 Realtime 订阅处理

        setEditingId(null);
        setEditText("");
      } catch (error) {
        console.error("Error updating todo:", error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute top-4 right-4 flex gap-4">
        {isLoading ? (
          // 加载状态时显示占位符
          <div className="h-10 w-20 bg-white/20 rounded-lg animate-pulse"></div>
        ) : user ? (
          // 已登录状态：显示退出登录按钮
          <form action={signOutAction}>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors duration-200 text-white font-medium flex items-center gap-2"
            >
              <span>退出登录</span>
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        ) : (
          // 未登录状态：显示登录和注册按钮
          <>
            <Link
              href="/sign-in"
              className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors duration-200 text-white font-medium"
            >
              登录
            </Link>
            <Link
              href="/sign-up"
              className="px-4 py-2 rounded-lg bg-white hover:bg-white/90 transition-colors duration-200 text-purple-600 font-medium"
            >
              注册
            </Link>
          </>
        )}
      </div>

      <div className="max-w-md mx-auto mt-40">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6">
          <h1 className="text-3xl font-bold text-white mb-8 text-center">
            熠辉Todo
          </h1>

          <form onSubmit={addTodo} className="mb-6">
            <div className="flex flex-col gap-2">
              <textarea
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                placeholder="添加新任务... 支持多行输入，可同时添加多个待办事项"
                className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 resize-none"
                rows={3}
                disabled={isSubmitting}
              />
              
              {/* 图片上传区域 */}
              <div className="mt-2">
                {imagePreview ? (
                  <div className="relative mt-2 rounded-lg overflow-hidden">
                    <img
                      src={imagePreview}
                      alt="预览"
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={clearSelectedImage}
                      className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors"
                      disabled={isSubmitting}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center w-full p-2 border-2 border-dashed border-white/30 rounded-lg cursor-pointer hover:border-white/50 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                      disabled={isSubmitting}
                    />
                    <span className="text-white/70 text-sm flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      点击上传图片（可自动识别图片中的待办事项）
                    </span>
                  </label>
                )}
                {isSubmitting && selectedImage && (
                  <div className="w-full bg-white/10 rounded-full h-2.5 mt-2">
                    <div
                      className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                )}
              </div>
              
              <button
                type="submit"
                className="p-3 rounded-lg bg-white/20 hover:bg-white/30 transition-colors duration-200 text-white flex items-center justify-center gap-2"
                disabled={isSubmitting || (!newTodo.trim() && !selectedImage)}
              >
                <Plus className="w-5 h-5" />
                <span>
                  {isSubmitting 
                    ? "处理中..." 
                    : selectedImage 
                      ? "AI识别图片并添加" 
                      : "AI解析并添加"
                  }
                </span>
              </button>
              
              {apiError && (
                <div className="mt-2 text-red-300 text-sm bg-red-500/20 p-2 rounded-lg">
                  {apiError}
                </div>
              )}
            </div>
          </form>

          {isLoading ? (
            // 加载状态显示骨架屏
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 bg-white/10 rounded-lg animate-pulse"
                ></div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className={cn(
                    "group flex flex-col p-3 rounded-lg transition-all duration-300",
                    "bg-white/10 hover:bg-white/20",
                    todo.completed && "opacity-75"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleTodo(todo.id)}
                      className="text-white hover:scale-110 transition-transform duration-200"
                      disabled={isSubmitting}
                    >
                      {todo.completed ? (
                        <Check className="w-6 h-6" />
                      ) : (
                        <Circle className="w-6 h-6" />
                      )}
                    </button>

                    {editingId === todo.id ? (
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="flex-1 px-3 py-1 rounded bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit();
                            if (e.key === "Escape") cancelEdit();
                          }}
                          disabled={isSubmitting}
                        />
                        <button
                          onClick={saveEdit}
                          className="p-1 text-white hover:text-green-300 transition-colors"
                          disabled={isSubmitting}
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1 text-white hover:text-red-300 transition-colors"
                          disabled={isSubmitting}
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <span
                        className={cn(
                          "flex-1 text-white transition-all duration-300",
                          todo.completed && "line-through opacity-75"
                        )}
                      >
                        {todo.text}
                      </span>
                    )}

                    {editingId !== todo.id && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={() => startEditing(todo)}
                          className="p-1 text-white hover:text-blue-300 transition-colors"
                          disabled={isSubmitting}
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => deleteTodo(todo.id)}
                          className="p-1 text-white hover:text-red-300 transition-colors"
                          disabled={isSubmitting}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 显示附件图片 */}
                  {todo.image_url && (
                    <div className="mt-2">
                      <a
                        href={todo.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={todo.image_url}
                          alt="附件"
                          className="w-full h-32 object-cover rounded-lg border border-white/20 hover:border-white/40 transition-colors"
                        />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!isLoading && todos.length === 0 && (
            <div className="text-center text-white/70 mt-8">
              {user ? (
                "开始计划点什么吧"
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <p>登录后开始制定您的Todo</p>
                  <Link
                    href="/sign-in"
                    className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors duration-200 text-white font-medium"
                  >
                    立即登录
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
