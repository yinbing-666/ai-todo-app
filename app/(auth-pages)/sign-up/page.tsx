import { signUpAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { SmtpMessage } from "../smtp-message";

export default async function Signup(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;
  if ("message" in searchParams) {
    return (
      <div className="w-full flex-1 flex items-center justify-center">
        <FormMessage message={searchParams} />
      </div>
    );
  }

  return (
    <>
      <form className="flex-1 flex flex-col max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-white mb-4">注册</h1>
        <p className="text-sm text-white/70 mb-8">
          已有账号？{" "}
          <Link className="text-white font-medium hover:text-white/90 underline underline-offset-4" href="/sign-in">
            登录
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
            <Label htmlFor="password" className="text-white">密码</Label>
            <Input
              type="password"
              name="password"
              placeholder="请输入密码"
              minLength={6}
              required
              className="bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:border-white/50"
            />
          </div>
          <SubmitButton
            formAction={signUpAction}
            pendingText="注册中..."
            className="w-full bg-white text-purple-600 hover:bg-white/90 mt-2"
          >
            注册
          </SubmitButton>
          <FormMessage message={searchParams} />
        </div>
      </form>
      <SmtpMessage />
    </>
  );
}
