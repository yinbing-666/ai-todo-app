import { signInAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default async function Login(props: { searchParams: Promise<Message> }) {
  const searchParams = await props.searchParams;
  return (
    <form className="flex-1 flex flex-col max-w-md mx-auto">
      <h1 className="text-3xl font-bold text-white mb-4">登录</h1>
      <p className="text-sm text-white/70 mb-8">
        还没有账号？{" "}
        <Link className="text-white font-medium hover:text-white/90 underline underline-offset-4" href="/sign-up">
          注册
        </Link>
      </p>
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-white">邮箱</Label>
          <Input
            name="email"
            placeholder="your@example.com"
            required
            className="bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:border-white/50"
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="password" className="text-white">密码</Label>
            <Link
              className="text-sm text-white/70 hover:text-white underline underline-offset-4"
              href="/forgot-password"
            >
              忘记密码？
            </Link>
          </div>
          <Input
            type="password"
            name="password"
            placeholder="请输入密码"
            required
            className="bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:border-white/50"
          />
        </div>
        <SubmitButton
          pendingText="登录中..."
          formAction={signInAction}
          className="w-full bg-white text-purple-600 hover:bg-white/90 mt-2"
        >
          登录
        </SubmitButton>
        <FormMessage message={searchParams} />
      </div>
    </form>
  );
}
