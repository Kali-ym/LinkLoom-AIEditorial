import { ContentPanel } from '@/components/ContentPanel';
import { FeedHeader } from '@/components/FeedHeader';
import { FEED_CATEGORIES } from '@/lib/categories';

export const metadata = { title: '关于' };

const SOURCE_TYPES = ['官方', 'X·KOL', '综合资讯', '学术机构', '大咖博客'] as const;

const ease = 'duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]';

export default function AboutPage() {
  return (
    <ContentPanel>
      <FeedHeader
        title="关于"
        description="LinkLoom 的两看板结构、分类约定、热度说明与版权声明。"
      />

      <article className="px-5 pb-12 pt-8 sm:px-8 sm:pb-16 sm:pt-10">
        {/* Lead + subscription */}
        <div className="grid gap-10 border-b border-hairline pb-10 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-14 lg:pb-12">
          <section className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
              Overview
            </p>
            <p className="mt-4 max-w-[38rem] text-pretty text-xl leading-[1.55] tracking-[-0.01em] text-body sm:text-[1.35rem] sm:leading-[1.5]">
              LinkLoom 面向 AI 从业者，提供两个看板：
              <strong className="font-medium text-body-strong">热搜</strong>
              （行业热事件 + 报道时间线）与
              <strong className="font-medium text-body-strong">信息流</strong>
              （可筛选时间线）。系统按小时抓取多源素材，由 AI 工作流评分、摘要、分类与推荐，并产出每日{' '}
              <strong className="font-medium text-body-strong">AI 日报</strong>。
            </p>
          </section>

          <aside className="flex flex-col justify-between border-t border-hairline pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
                Subscription
              </p>
              <h2 className="mt-3 font-display text-2xl font-normal tracking-[-0.03em] text-ink">
                订阅信息流
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                使用 RSS 跟踪每日自动精选内容。
              </p>
            </div>
            <a
              href="/rss.xml"
              className={`mt-6 inline-flex h-10 w-fit items-center rounded-md border border-hairline bg-surface-card px-4 font-mono text-sm font-medium text-ink shadow-subtle transition-[border-color,color,transform] ${ease} hover:border-primary/45 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 active:scale-[0.98]`}
            >
              /rss.xml
            </a>
          </aside>
        </div>

        {/* Heat — visual anchor */}
        <section className="border-b border-hairline py-10 sm:py-12">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-3xl font-normal tracking-[-0.03em] text-ink sm:text-[2.15rem]">
              热度说明
            </h2>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Ranking
            </p>
          </div>
          <p className="mt-4 max-w-[40rem] leading-relaxed text-body">
            热搜排名可解释，不单靠条目的原始 AI 分数。实时榜热度大致为：
          </p>
          <div className="mt-5 overflow-x-auto rounded-xl border border-hairline bg-surface-soft/80 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] sm:px-5 sm:py-5 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <p className="font-mono text-[13px] leading-relaxed text-body-strong sm:text-sm">
              heat ≈ quality × log₂(1 + 独立信源数) × 时效衰减(半衰期约 8h) × 精选加权(有
              picked 则 ×1.25)
            </p>
          </div>
          <p className="mt-4 max-w-[40rem] text-sm leading-relaxed text-muted">
            周榜 / 月榜与实时榜共用同一套事件簇：按簇内最新发布时间是否落在上海自然周（周一起）
            / 自然月筛选整簇上榜，不做时效衰减；成员关系只由实时近窗合并维护。
          </p>
        </section>

        {/* Classification */}
        <section className="border-b border-hairline py-10 sm:py-12">
          <h2 className="font-display text-3xl font-normal tracking-[-0.03em] text-ink sm:text-[2.15rem]">
            分类约定
          </h2>
          <div className="mt-8 grid gap-10 sm:grid-cols-2 sm:gap-12">
            <div>
              <h3 className="text-[13px] font-medium tracking-wide text-ink">来源类型</h3>
              <ul className="mt-4 flex flex-wrap gap-2">
                {SOURCE_TYPES.map((label) => (
                  <li
                    key={label}
                    className="rounded-md border border-hairline bg-surface-card px-2.5 py-1 text-sm text-body"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[13px] font-medium tracking-wide text-ink">六栏分类</h3>
              <ul className="mt-4 flex flex-wrap gap-2">
                {FEED_CATEGORIES.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-md border border-hairline bg-surface-card px-2.5 py-1 text-sm text-body"
                  >
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Quiet notes */}
        <div className="divide-y divide-hairline">
          <section className="py-8 sm:py-9">
            <h2 className="font-display text-2xl font-normal tracking-[-0.03em] text-ink">
              信息流筛选
            </h2>
            <p className="mt-3 max-w-[40rem] leading-relaxed text-body">
              信息流支持精选、六栏分类、#话题包含 / 排除，以及关键词搜索，便于在信息洪流中按条件取流。
            </p>
          </section>

          <section className="py-8 sm:py-9">
            <h2 className="font-display text-2xl font-normal tracking-[-0.03em] text-ink">
              详情与版权
            </h2>
            <p className="mt-3 max-w-[40rem] leading-relaxed text-body">
              点击标题进入站内详情{' '}
              <code className="rounded bg-surface-soft px-1.5 py-0.5 font-mono text-[0.9em] text-body-strong">
                /items/[id]
              </code>
              ；正文来自已采集摘要或正文的降级展示。第三方原文为次链。版权归原作者 / 原站，请以原文为准。摘要由
              LLM 生成，可能存在偏差或遗漏。
            </p>
          </section>

          <section className="py-8 sm:py-9">
            <h2 className="font-display text-2xl font-normal tracking-[-0.03em] text-ink">
              信源头像
            </h2>
            <p className="mt-3 max-w-[40rem] leading-relaxed text-body">
              热搜时间线使用站点 favicon（浏览器标题栏图标）作为信源头像；加载失败时显示信源名首字色块，避免裂图。
            </p>
          </section>

          <section className="py-8 sm:pb-2 sm:pt-9">
            <h2 className="font-display text-2xl font-normal tracking-[-0.03em] text-ink">
              数据声明
            </h2>
            <p className="mt-3 max-w-[40rem] leading-relaxed text-body">
              所有摘要由大语言模型生成，可能存在偏差或遗漏。标题默认进入站内详情核实；需要对照原文时，请通过详情页的原文链接前往第三方来源。
            </p>
          </section>
        </div>
      </article>
    </ContentPanel>
  );
}
