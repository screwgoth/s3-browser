"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { SiteLogo } from "@/components/site-logo";

const formSchema = z.object({
  username: z.string().min(1, { message: "Username is required." }),
  password: z.string().min(1, { message: "Password is required." }),
});

type LoginFormValues = z.infer<typeof formSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Login Successful",
          description: "Welcome back!",
          duration: 1000,
        });

        // Check if password change is required
        if (data.user.must_change_password) {
          setTimeout(() => {
            router.push("/change-password");
          }, 500);
        } else {
          setTimeout(() => {
            router.push("/");
          }, 500);
        }
      } else {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: data.error || "Invalid username or password.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 skeu-bg">
      {/* Site Logo */}
      <div className="mb-6 flex flex-col items-center gap-3">
        <SiteLogo size="lg" />
      </div>

      {/* 3D ASCII Art Title */}
      <div className="mb-8 text-center">
        <pre className="text-[9px] sm:text-[11px] md:text-sm font-mono font-bold leading-tight select-none">
          <span className="text-blue-600 dark:text-blue-400">
{`
   ██████╗ ██████╗     ██████╗ ██████╗  ██████╗ ██╗    ██╗███████╗███████╗██████╗ 
  ██╔════╝ ╚════██╗    ██╔══██╗██╔══██╗██╔═══██╗██║    ██║██╔════╝██╔════╝██╔══██╗
  ╚█████╗   █████╔╝    ██████╔╝██████╔╝██║   ██║██║ █╗ ██║███████╗█████╗  ██████╔╝
   ╚═══██╗  ╚═══██╗    ██╔══██╗██╔══██╗██║   ██║██║███╗██║╚════██║██╔══╝  ██╔══██╗
  ██████╔╝ ██████╔╝    ██████╔╝██║  ██║╚██████╔╝╚███╔███╔╝███████║███████╗██║  ██║
  ╚═════╝  ╚═════╝     ╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚══╝╚══╝ ╚══════╝╚══════╝╚═╝  ╚═╝
`}
          </span>
          <span className="text-indigo-500/50 dark:text-indigo-400/30 absolute top-[2px] left-[2px] -z-10">
{`
   ██████╗ ██████╗     ██████╗ ██████╗  ██████╗ ██╗    ██╗███████╗███████╗██████╗ 
  ██╔════╝ ╚════██╗    ██╔══██╗██╔══██╗██╔═══██╗██║    ██║██╔════╝██╔════╝██╔══██╗
  ╚█████╗   █████╔╝    ██████╔╝██████╔╝██║   ██║██║ █╗ ██║███████╗█████╗  ██████╔╝
   ╚═══██╗  ╚═══██╗    ██╔══██╗██╔══██╗██║   ██║██║███╗██║╚════██║██╔══╝  ██╔══██╗
  ██████╔╝ ██████╔╝    ██████╔╝██║  ██║╚██████╔╝╚███╔███╔╝███████║███████╗██║  ██║
  ╚═════╝  ╚═════╝     ╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚══╝╚══╝ ╚══════╝╚══════╝╚═╝  ╚═╝
`}
          </span>
        </pre>
      </div>

      <Card className="w-full max-w-sm skeu-login-card border-0">
        <CardHeader className="space-y-1 rounded-t-2xl border-b bg-gradient-to-b from-white/80 to-slate-50/80">
          <CardTitle className="text-2xl font-bold text-center">Login</CardTitle>
          <CardDescription className="text-center">Enter your credentials to continue</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter username" 
                        {...field}
                        autoComplete="username"
                        className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter password"
                          autoComplete="current-password"
                          {...field}
                          className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute inset-y-0 right-0 h-full"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full skeu-btn border-0"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Subtle footer text */}
      <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
        <p>Secure S3 Bucket Management</p>
        <p className="text-xs mt-1">Default: admin / admin (change password on first login)</p>
      </div>
    </main>
  );
}
