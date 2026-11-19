import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/article-body";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { listHelpArticles } from "@/lib/support/triage-client";

type Params = Promise<{ slug: string }>;

async function findArticle(slug: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  return (await listHelpArticles())?.find((a) => a.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const article = await findArticle((await params).slug);
  return { title: article?.title ?? "Help article" };
}

export default async function HelpArticlePage({ params }: { params: Params }) {
  const article = await findArticle((await params).slug);
  if (!article) notFound();

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/help" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> Help centre
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance">{article.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Updated {formatDate(new Date(article.updatedAt))}</p>
      <div className="mt-8">
        <ArticleBody body={article.body} />
      </div>
      <div className="mt-10 rounded-xl border bg-muted/30 p-5 text-sm">
        <p className="font-medium">Didn&apos;t answer your question?</p>
        <Button asChild size="sm" className="mt-3">
          <Link href="/account/support/new">Contact support</Link>
        </Button>
      </div>
    </article>
  );
}
