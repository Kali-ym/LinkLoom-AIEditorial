import React from 'react';

type SettingsSectionCardProps = {
  section: {
    id: string;
    title: string;
    description: string;
    fields: Array<{ key: string } & Record<string, any>>;
  };
  renderField: (field: any) => React.ReactNode;
  footer?: React.ReactNode;
};

const SettingsSectionCard: React.FC<SettingsSectionCardProps> = ({ section, renderField, footer }) => (
    <div
    key={section.id}
    className="bg-canvas dark:bg-surface-dark rounded-3xl border border-hairline-soft dark:border-white/5 overflow-hidden card-interactive-subtle"
  >
    <div className="px-5 py-5 md:px-8 md:py-6 border-b border-hairline-soft dark:border-white/5 bg-surface-soft/80 dark:bg-white/[0.02]">
      <h3 className="text-[18px] font-medium text-text-ink dark:text-white mb-1 tracking-tight">{section.title}</h3>
      <p className="text-text-slate dark:text-text-secondary text-[13px]">{section.description}</p>
    </div>

    <div className="p-4 md:p-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {section.fields.map((field) => (
          <React.Fragment key={field.key}>
            {renderField(field)}
          </React.Fragment>
        ))}
      </div>
      {footer}
    </div>
  </div>
);

export default SettingsSectionCard;
