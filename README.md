# 💸 App de Organização de Finanças Pessoais

PRD refinado:

```
# Personal Finance Chat

## Product Vision

Aplicativo web de finanças pessoais que permita aos usuários controlar receitas, despesas e metas financeiras através de conversas em linguagem natural.
Um produto extremamente simples, focado em iniciantes que não gostam de planilhas ou aplicativos financeiros complexos.
A principal proposta de valor é permitir que qualquer pessoa organize sua vida financeira apenas conversando com um assistente virtual.

---

# Problem

Muitas pessoas desejam controlar suas finanças, mas abandonam rapidamente aplicativos tradicionais devido a:

- Excesso de formulários.
- Interfaces complexas.
- Curva de aprendizado alta.
- Falta de personalização.
- Pouco suporte educacional.

O resultado é a falta de controle sobre gastos, dívidas e objetivos financeiros.

---

# Target Users

## Primary Users

Pessoas entre 18 e 45 anos que:

- Nunca utilizaram aplicativos financeiros.
- Não gostam de planilhas.
- Possuem pouco conhecimento financeiro.
- Querem uma solução simples e prática.

## User Goals

- Registrar gastos rapidamente.
- Entender para onde o dinheiro está indo.
- Criar hábitos financeiros melhores.
- Economizar dinheiro.
- Atingir metas financeiras.

---

# Product Principles

## Conversational First

A conversa deve ser a principal forma de interação.
O usuário deve conseguir utilizar o aplicativo sem precisar preencher formulários complexos.

## Simplicity

Toda funcionalidade deve ser simples e intuitiva.

## Universal Design

O sistema deve ser acessível para o maior número possível de pessoas.

Princípios:

- Linguagem simples.
- Botões grandes.
- Alto contraste.
- Interface limpa.
- Baixa carga cognitiva.
- Design responsivo.
- Acessibilidade básica.

## Educational Experience

O aplicativo deve ensinar educação financeira de forma leve durante o uso.

---

# MVP Features

## Feature 1 - Financial Chat

O usuário pode enviar mensagens em linguagem natural.

Exemplos:

"Gastei R$ 50 no almoço."

"Recebi R$ 2500 de salário."

"Comprei remédios por R$ 40."

O sistema deve identificar automaticamente:

- Tipo da movimentação.
- Valor.
- Categoria.
- Data.

---

## Feature 2 - Automatic Categorization

Categorias iniciais:

- Alimentação
- Transporte
- Moradia
- Saúde
- Educação
- Lazer
- Compras
- Outros

O sistema deve atribuir categorias automaticamente.

---

## Feature 3 - Dashboard

Criar um dashboard simples contendo:

- Total de receitas.
- Total de despesas.
- Saldo atual.
- Gastos por categoria.
- Evolução mensal.

Utilizar gráficos simples e legíveis.

---

## Feature 4 - Financial Goals

Permitir criação de metas financeiras.

Exemplos:

- Reserva de emergência.
- Viagem.
- Novo computador.
- Curso.

Cada meta deve mostrar:

- Valor alvo.
- Valor atual.
- Percentual concluído.

---

## Feature 5 - Financial Assistant

Criar um agente financeiro virtual.

Responsabilidades:

- Identificar padrões de gasto.
- Gerar dicas de economia.
- Alertar sobre excessos.
- Incentivar hábitos financeiros saudáveis.

Exemplo:

"Seus gastos com delivery aumentaram 20% neste mês."

---

# Main User Flow

## First Access

1. Usuário cria conta.
2. Sistema apresenta onboarding simples.
3. Usuário registra primeira movimentação.
4. Dashboard é atualizado.
5. Sistema apresenta primeiro insight.

---

## Daily Usage

1. Usuário envia mensagem.
2. Sistema interpreta.
3. Sistema registra a movimentação.
4. Dashboard é atualizado.
5. Agente financeiro gera sugestões quando aplicável.

---

# Required Pages

## Login Page

Campos:

- E-mail
- Senha

Botões:

- Entrar
- Criar conta

---

## Register Page

Campos:

- Nome
- E-mail
- Senha

---

## Chat Page

Elementos:

- Histórico da conversa.
- Campo de mensagem.
- Botão de envio.
- Sugestões rápidas.

Esta deve ser a principal tela do sistema.

---

## Dashboard Page

Componentes:

- Cartão de saldo.
- Cartão de receitas.
- Cartão de despesas.
- Gráfico de categorias.
- Gráfico mensal.
- Insights financeiros.

---

## Goals Page

Componentes:

- Lista de metas.
- Barra de progresso.
- Botão para criar meta.

---

## Profile Page

Componentes:

- Dados do usuário.
- Preferências.
- Configurações.

---

# Database Structure

## Users

- id
- name
- email
- password
- created_at

## Transactions

- id
- user_id
- type
- category
- amount
- description
- date
- created_at

## Goals

- id
- user_id
- title
- target_amount
- current_amount
- deadline
- created_at

---

# Visual Design

Estilo moderno inspirado em:

- Notion
- Linear
- Rocket Money
- Monzo

Características:

- Minimalista.
- Muito espaço em branco.
- Layout limpo.
- Paleta neutra.
- Interface mobile-first.
- Componentes modernos.
- Bordas suaves.
- Sombras discretas.

---

# Technical Requirements

- Aplicação Web responsiva.
- Mobile-first.
- Autenticação de usuários.
- Persistência de dados.
- Dashboard em tempo real.
- Estrutura preparada para futuras integrações com IA.

---

# Out of Scope

Não implementar nesta versão:

- Integração bancária.
- Open Finance.
- Investimentos.
- Cartão de crédito avançado.
- Compartilhamento familiar.
- Planejamento tributário.
- Marketplace financeiro.

---

# Success Criteria

O MVP será considerado bem-sucedido quando um usuário iniciante conseguir:

1. Criar conta.
2. Registrar receitas e despesas via conversa.
3. Visualizar seu saldo.
4. Acompanhar metas financeiras.
5. Entender melhor seus hábitos de consumo.

A experiência deve parecer uma conversa com um assistente financeiro pessoal, simples, amigável e acessível.

```



