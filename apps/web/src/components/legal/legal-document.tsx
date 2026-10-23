import { FileWarning } from "lucide-react";

import styles from "./legal-document.module.scss";

export type LegalSection = Readonly<{
  id: string;
  title: string;
  paragraphs: readonly string[];
  items?: readonly string[];
}>;

type LegalDocumentProps = Readonly<{
  title: string;
  description: string;
  updatedAt: string;
  sections: readonly LegalSection[];
}>;

export function LegalDocument({ description, sections, title, updatedAt }: LegalDocumentProps) {
  return (
    <article className={styles.document}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Документы</p>
        <h1>{title}</h1>
        <p className={styles.description}>{description}</p>
        <p className={styles.updated}>Обновлено: {updatedAt}</p>
      </header>

      <aside className={styles.draftNotice}>
        <FileWarning aria-hidden="true" />
        <div>
          <strong>Черновик для разработки</strong>
          <p>
            Документ описывает запланированное поведение MVP. Перед публикацией его проверит
            владелец продукта и будут добавлены реквизиты оператора.
          </p>
        </div>
      </aside>

      <div className={styles.layout}>
        <nav aria-label={`Содержание документа «${title}»`} className={styles.contents}>
          <p>Содержание</p>
          <ol>
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className={styles.sections}>
          {sections.map((section) => (
            <section id={section.id} key={section.id}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.items ? (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
