# Diagrama de fluxo de navegação — Planner Pro

Este diagrama foi gerado com base na lógica de navegação presente em `src/App.jsx` (autenticação/entrada) e `src/components/Dashboard.jsx` (abas internas).

```mermaid
flowchart TD
    A[App inicia] --> B{Sessão carregada?}
    B -- Não --> C[Tela de loading<br/>"Sincronizando..."]
    C --> B

    B -- Sim --> D{Usuário autenticado?}

    D -- Não --> E{Cadastro concluído?}
    E -- Sim --> F[SuccessScreen]
    E -- Não --> G{mostrarLogin?}
    G -- Não --> H[Welcomescreen]
    H -->|Get Started| I[Form de autenticação]
    G -- Sim --> I

    I --> J{Tipo de formulário}
    J -->|login| K[Login com e-mail/senha]
    J -->|cadastro| L[Cadastro]
    I --> M[Login com Google OAuth]

    K --> N{Autenticou?}
    L --> N
    M --> N
    N -- Sim --> O[Dashboard]
    N -- Não --> I

    D -- Sim --> O

    O --> P[Menu lateral]

    P --> Q[Dashboard Geral]
    P --> R[Workspace]
    P --> S[Constância]

    P --> T[Matérias]
    P --> U[Ciclo de Estudos]
    P --> V[Calendário]
    P --> W[To-Do]

    P --> X[Estudar Agora]
    P --> Y[Flashcards]
    P --> Z[Anotações]

    P --> AA[Revisões]
    P --> AB[Histórico]
    P --> AC[Amizades]

    O --> AD[Botão Sair]
    AD --> D
```

## Observações rápidas

- O `App` controla a navegação macro (welcome, autenticação, sucesso de cadastro e dashboard).
- O `Dashboard` controla a navegação interna por abas via estado (`abaAtiva`), sem `react-router`.
- Ao clicar em **Sair**, ocorre `supabase.auth.signOut()` e o fluxo retorna para estado não autenticado.
