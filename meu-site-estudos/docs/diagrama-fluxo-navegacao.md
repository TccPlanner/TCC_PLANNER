# Diagrama de fluxo de navegação — Planner Pro

Este diagrama foi gerado com base na estrutura atual de `src/App.jsx` e `src/components/Dashboard.jsx`.

```mermaid
flowchart TD
    A[App inicia] --> B{Loading + sem usuário?}
    B -- Sim --> C[Tela de carregamento<br/>"Sincronizando..."]
    C --> B
    B -- Não --> D{Usuário autenticado?}

    D -- Não --> E{Cadastro concluído?}
    E -- Sim --> F[SuccessScreen]
    E -- Não --> G{mostrarLogin?}
    G -- Não --> H[Welcomescreen]
    H -->|Get Started| I[Formulário de autenticação]
    G -- Sim --> I

    I --> J{tipoForm}
    J -->|login| K[Login com e-mail/senha]
    J -->|cadastro| L[Cadastro + upsert em perfis]
    I --> M[Login com Google OAuth]

    K --> N{Autenticou?}
    L --> N
    M --> N
    N -- Sim --> O[Dashboard]
    N -- Não --> I

    D -- Sim --> O

    O --> P[Menu lateral]

    subgraph VG[VISÃO GERAL]
      Q[Dashboard Geral]
      R[Workspace]
      S[Constância]
    end

    subgraph PL[PLANEJAMENTO]
      T[Matérias]
      U[Ciclo de Estudos]
      V[Calendário]
      W[To-Do]
    end

    subgraph EX[EXECUÇÃO]
      X[Estudar Agora]
      Y[Flashcards]
      Z[Anotações]
    end

    subgraph AC[ACOMPANHAMENTO]
      AA[Revisões]
      AB[Histórico]
      AC1[Amizades]
    end

    P --> Q
    P --> R
    P --> S
    P --> T
    P --> U
    P --> V
    P --> W
    P --> X
    P --> Y
    P --> Z
    P --> AA
    P --> AB
    P --> AC1

    O --> AD[Botão Sair]
    AD --> D
```

## Observações rápidas

- A navegação principal é controlada por estados locais (sem `react-router`).
- `App.jsx` decide entre welcome, autenticação, sucesso de cadastro e dashboard.
- `Dashboard.jsx` troca de módulos internos pela `abaAtiva` a partir do menu lateral.
- O logout (`supabase.auth.signOut()`) dispara retorno para o estado não autenticado no `App`.
