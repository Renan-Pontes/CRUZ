# CRUZ - Frontend Mobile App

Aplicativo móvel gamificado para treinamento de farmácia, desenvolvido com React Native e Expo.

## 📱 Visão Geral

O CRUZ é uma plataforma de aprendizado que utiliza gamificação para treinar farmacêuticos e atendentes. O app apresenta uma trilha de aprendizado interativa com diversos tipos de desafios.

### Principais Funcionalidades

- **Autenticação**: Login e Registro de usuários.
- **Trilha de Aprendizado**: Uma jornada visual (estilo mapa) onde o usuário progride completando módulos.
- **Minigames**:
  - **Encontre os Erros**: Identifique erros em receitas médicas (Tipos A, B e C).
  - **Separação**: Simulação de separação de medicamentos nas prateleiras.
  - **Atendimento**: Cenários de interação com clientes para testar soft skills e conhecimento técnico.
- **Perfil e Gamificação**: Sistema de XP, Níveis, Ofensiva (Streak) e Conquistas (Badges).

## 🛠️ Tecnologias

- **React Native** (via Expo)
- **TypeScript**
- **Expo Router** (Navegação baseada em arquivos)
- **Context API** (Gerenciamento de estado global)

## 🚀 Como Rodar

### Pré-requisitos
- Node.js instalado
- Gerenciador de pacotes (npm ou yarn)
- Backend rodando (veja `../backend/README.md`)

### Instalação

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure o endereço da API:
   - O app tenta detectar automaticamente (`localhost` ou `10.0.2.2` para Android Emulator).
   - Para forçar um IP (ex: dispositivo físico), crie um arquivo `.env` ou edite `services/api.ts` se necessário (embora a detecção automática costuma funcionar).

3. Execute o projeto:
   ```bash
   npx expo start
   ```

4. Abra no seu dispositivo:
   - **Android Emulator**: Pressione `a` no terminal.
   - **iOS Simulator**: Pressione `i` no terminal (macOS apenas).
   - **Dispositivo Físico**: Instale o app "Expo Go" e escaneie o QR Code.

## 📂 Estrutura do Projeto

- `app/`: Rotas e telas do aplicativo (Expo Router).
  - `(app)/`: Rotas protegidas (Trilha, Games, Perfil).
  - `sign-in.tsx`, `sign-up.tsx`: Telas de autenticação.
- `components/`: Componentes reutilizáveis (UI, Trilha, etc).
- `context/`: Gerenciamento de estado (Auth, AppData).
- `services/`: Comunicação com a API (`api.ts`).
- `assets/`: Imagens e fontes.

## 🧩 Detalhes dos Minigames

### Encontre os Erros
O usuário analisa uma imagem de receita e deve clicar nos erros ou selecionar opções incorretas.
- Suporta rotação de tela para melhor visualização de receitas horizontais.

### Separação
O usuário deve encontrar o medicamento correto em uma lista ou prateleira virtual baseada na prescrição.

### Atendimento
Simulação de chat ou quiz onde o usuário escolhe a melhor resposta para lidar com situações de atendimento.
