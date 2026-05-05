# Nexus - Project Management Application

Nexus is a modern, high-performance project management web application designed for teams to connect tasks, teams, and goals seamlessly.

## 🚀 Key Features

- **Dynamic Dashboard**: Real-time overview of tasks, team performance, and activity logs.
- **Advanced Admin Dashboard**: 
  - **User-Specific Filtering**: Focus the entire dashboard on a single team member to track their specific progress.
  - **KPI Analytics**: Instant metrics for 7 unique task statuses (Pending, In Progress, Awaiting Zoho/Client/Team, Done, Cancelled).
- **Optimized Kanban Board**: High-density 4-column grid layout that eliminates horizontal scrolling and provides a clear birds-eye view of the entire project pipeline.
- **Excel Data Export**: 📥 Export organization-wide data into Excel-compatible reports (UTF-8 BOM supported) with a single click from the Dashboard or Reports page.
- **Intelligent Task Tracking**:
  - **User & Priority Filtering**: Quickly narrow down tasks by assignee, priority, or status.
  - **Overdue Management**: Automated highlighting of tasks past their deadline.
- **Role-Based Access Control (RBAC)**:
  - **Admin**: Full organization management, team creation, and deep analytics.
  - **Manager**: Project oversight and team task assignment.
  - **Team Member**: Personal task tracking and project collaboration.
- **Team Management**: Robust search and management tools to oversee organization roles, departments, and member status.

## 🛠️ Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database & Auth**: Supabase
- **Styling**: Vanilla CSS (Premium Glassmorphism Design)
- **Reporting**: Excel-compatible CSV generation with BOM for seamless data analysis.

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
