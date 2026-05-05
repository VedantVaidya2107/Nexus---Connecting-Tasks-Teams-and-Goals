# Nexus - Project Management Application

Nexus is a modern, high-performance project management web application designed for teams to connect tasks, teams, and goals seamlessly.

## 🚀 Features

- **Dynamic Dashboard**: Real-time overview of tasks, team performance, and activity logs.
- **Kanban & List Views**: Flexible task management with drag-and-drop status updates.
- **Role-Based Access Control (RBAC)**:
  - **Admin**: Full organization management, team creation, and analytics.
  - **Manager**: Project oversight and team task assignment.
  - **Team Member**: Personal task tracking and project collaboration.
- **Team Management**: Admin tools to invite members and manage roles.
- **Daily Alignment**: Standup tracking and goal-oriented task progress.

## 🛠️ Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database & Auth**: Supabase
- **Styling**: Vanilla CSS (Premium Glassmorphism Design)
- **Icons**: Emoji-based for lightweight and consistent UI.

## 📦 Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd nexus
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Create a `.env.local` file in the root directory and add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_public_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

4. **Database Schema**:
   Run the provided migrations in your Supabase SQL Editor to set up the `profiles`, `tasks`, `projects`, and `activity_log` tables.

5. **Run the development server**:
   ```bash
   npm run dev
   ```

## 🛡️ Security

Nexus uses **Supabase Row Level Security (RLS)** to ensure data privacy. Users can only access projects and tasks they are assigned to, while admins have global visibility. Administrative actions like creating new users are handled through secure Server Side API routes using the Service Role key.

## 🎨 Design Philosophy

Nexus features a **Premium Dark Mode** with a glassmorphism aesthetic. It prioritizes:
- **Visual Clarity**: High contrast and color-coded status indicators.
- **Responsiveness**: Fully adaptive layout for desktop and mobile.
- **Micro-interactions**: Smooth transitions and hover effects for a premium feel.

---

Built with ❤️ by Antigravity.
