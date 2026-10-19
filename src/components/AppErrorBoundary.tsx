import React from "react";

type State = { error: Error | null };

export class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, _info: React.ErrorInfo) {
    // Avoid serializing exception messages or component props into browser logs.
    console.error("OPERA_RENDER_FAILED", error.name);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main role="alert" style={{
        minHeight: "100vh", background: "#0b0f14", color: "#f8fafc",
        display: "grid", placeItems: "center", padding: "24px",
        fontFamily: "system-ui, sans-serif"
      }}>
        <section style={{ maxWidth: 480 }}>
          <h1>Não foi possível abrir o OPERA Atlas</h1>
          <p>O aplicativo encontrou uma falha de carregamento. Nenhum dado foi alterado.</p>
          <p>Tente atualizar a página. Se continuar, informe o suporte.</p>
          <button type="button" onClick={() => window.location.reload()}
            style={{ padding: "12px 18px", cursor: "pointer" }}>
            Tentar novamente
          </button>
        </section>
      </main>
    );
  }
}
