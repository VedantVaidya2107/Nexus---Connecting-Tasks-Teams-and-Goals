# Nexus - Project Management Application

Nexus is a modern, high-performance project management web application designed for teams to connect tasks, teams, and goals seamlessly.

## 🚀 Key Features

- **AI Action Agent**: Integrated with **Gemini 2.5 Flash**, the AI can now directly execute database operations:
  - **Create Tasks**: Simply ask the bot to create a task, and it will handle the database entry.
  - **Update Status**: Change task statuses (e.g., "Set task X to Done") through natural language.
  - **Reassign Tasks**: Hand off tasks to different team members via chat.
- **Dynamic Dashboard**: Real-time overview of tasks, team performance, and activity logs.
- **Cinematic UI Experience**:
  - **Staggered Animations**: Fluid, GPU-accelerated page transitions, cascading Kanban columns, and data table rows powered by Framer Motion.
  - **Interactive Elements**: Animated KPI counters, pop-up modals, and spring-loaded hover states for premium micro-interactions.
  - **Dynamic Backgrounds**: Optimized floating cinematic orbs, a subtle particle field, and drifting mesh layers that create a high-end atmosphere while maintaining 60FPS.
  - **Deep Glassmorphism**: Unified transparency design system featuring responsive hover elevations, ambient shadow-casting, and glowing data containers.
- **Project & Team Management**:
  - **Project Membership**: Multi-user assignment to projects via a dedicated "Project Team" selector.
  - **Role-Based Access Control**: Restricted editing and reporting views based on user roles (Admin/Manager/Member).
- **KPI Analytics**: Instant metrics for 7 unique task statuses (Pending, In Progress, Awaiting Zoho/Client/Team, Done, Cancelled) with zero-data protection.
- **Excel Data Export**: 📥 Export organization-wide data into Excel-compatible reports with a single click.
- **Kanban Pipeline**: High-density 4-column grid layout for maximum task visibility.

## 🛠️ Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **AI Engine**: Google Gemini 2.5 Flash (Action-Oriented Intent Parsing)
- **Database & Auth**: Supabase (PostgreSQL with RLS)
- **Styling & Animation**: Vanilla CSS (Custom Cinematic Design System) + Framer Motion
- **Reporting**: Excel-compatible CSV generation with BOM support.

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
- **High-Density Productivity**: Layouts like the 4-column Kanban grid are designed to show maximum information with minimum interaction.
- **Visual Clarity**: Color-coded status chips and priority tags for instant recognition.
- **Administrative Efficiency**: One-click filters and exports for rapid decision-making.

---

Built with ❤️ by Antigravity.
