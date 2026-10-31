"use client";

import { CircleAlert } from "lucide-react";
import { Component, type ReactNode } from "react";

import styles from "./widget-card.module.scss";

type WidgetErrorBoundaryProps = Readonly<{
  title: string;
  children: ReactNode;
}>;

type WidgetErrorBoundaryState = Readonly<{
  hasError: boolean;
}>;

export class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  override state: WidgetErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): WidgetErrorBoundaryState {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <article aria-label={this.props.title} className={styles.card} data-status="error">
          <header className={styles.header}>
            <h2 className={styles.title}>{this.props.title}</h2>
          </header>
          <div className={styles.statusPanel} role="alert">
            <CircleAlert aria-hidden="true" strokeWidth={1.75} />
            <h3>Не удалось показать виджет</h3>
            <p>Ошибка осталась внутри карточки. Остальные виджеты продолжают работать.</p>
            <button
              className={styles.statusAction}
              onClick={() => {
                this.setState({ hasError: false });
              }}
              type="button"
            >
              Повторить
            </button>
          </div>
        </article>
      );
    }

    return this.props.children;
  }
}
