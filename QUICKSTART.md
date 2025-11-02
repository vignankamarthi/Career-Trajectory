# Career Trajectory AI - Quick Start Guide

Welcome to Career Trajectory AI! This guide will help you create your personalized career timeline in minutes.

## What This App Does

Career Trajectory AI is an intelligent assistant that helps you plan your career path. Simply tell it your goals, and it will:

- Create a visual timeline of your journey
- Break down your path into manageable steps
- Research relevant information (universities, job markets, skills)
- Help you refine your plan through conversation

## Getting Started

### Step 1: Launch the Application

1. **Start the Backend Server**
   - Open Terminal (Mac) or Command Prompt (Windows)
   - Navigate to the project folder: `cd Career-Trajectory/backend`
   - Run: `npm run dev`
   - Wait until you see: "Server ready to accept requests"

2. **Start the Frontend**
   - Open a NEW Terminal/Command Prompt window
   - Navigate to frontend: `cd Career-Trajectory/frontend`
   - Run: `npm run dev`
   - Open your browser to: http://localhost:3000

### Step 2: Configure Your Timeline

When you first open the app, you'll see a chat interface. The AI will ask you questions like:

- **What's your career goal?** (Example: "Become a Senior AI Researcher")
- **Where are you starting from?** (Example: "I'm 22, just graduated with CS degree")
- **What's your timeframe?** (Example: "I want to achieve this by age 35")
- **Any constraints?** (Example: "Need to stay in California, have $30k student debt")

**Tips:**
- Be specific about your goals
- Mention any important limitations (location, money, time)
- Don't worry if you're not sure - the AI will ask clarifying questions

### Step 3: Review Your Timeline

After answering the questions, the AI will generate a **3-layer timeline**:

**Layer 1 (Strategic)**: Big milestones (4-10 years each)
- Example: "Complete PhD in AI" (6 years)

**Layer 2 (Tactical)**: Medium-term goals (0-5 years each)
- Example: "Publish first research paper" (2 years)

**Layer 3 (Execution)**: Immediate actions (0-1 year each)
- Example: "Apply to top AI conferences" (6 months)

**Visual Indicators:**
- **Pulsing blue dot** on a block = Research in progress
- **Green glow** on a block = Research completed
- **Toast notifications** (bottom-right) = Real-time updates

### Step 4: Interact With Your Timeline

**Click any block** to:
- View detailed information
- Edit the timeline
- Add notes or resources

**Use the Chat** (top-right "Show Chat" button):
- Ask questions about your timeline
- Request changes: "Can you add more detail to the PhD phase?"
- Get advice: "What skills do I need for this role?"

**Save Your Timeline**:
1. Click the green "Save" button
2. Choose an option:
   - **Save Only**: No validation, instant save
   - **Lite Check**: Quick AI validation (~$0.005, 30 seconds)
   - **Refactor**: Deep analysis with research (~$0.15, 2-3 minutes)

**Export for Other AI Tools**:
- Click "Export for LLM"
- Downloads a text file optimized for ChatGPT, Claude, etc.
- Share your timeline with other AI assistants for feedback

## Understanding Real-Time Research

Career Trajectory AI can research information for you automatically:

**What gets researched?**
- Universities and admission requirements
- Job market trends and salaries
- Required skills and learning resources
- Timeline optimization strategies

**How to track research:**
1. **Blue pulsing dot** appears on blocks being researched
2. **Toast notification** shows research started (bottom-right corner)
3. **Green glow** appears when research completes
4. Click the block to see research results

**Research costs:**
- Quick lookups: $0.005 (5-60 seconds) - Auto-approved
- Standard research: $0.02 (30s-2m)
- Deep analysis: $0.10-$2.40 (1-20 minutes)

The app will ask for your approval before running expensive research.

## Tips for Best Results

### Be Specific
- **Vague**: "I want to work in tech"
- **Specific**: "I want to be a Machine Learning Engineer at a FAANG company"

### Include Context
- Mention your current skills, education, and experience
- Share any personal constraints (family, location, finances)
- Specify your timeline (realistic dates)

### Use the Chat Feature
The timeline is just a starting point! Use chat to:
- Ask "why" questions: "Why is this step taking 2 years?"
- Request alternatives: "What if I don't have time for a PhD?"
- Get specific advice: "What online courses should I take?"

### Save Regularly
- Use "Save Only" frequently (free, instant)
- Use "Lite Check" before major decisions ($0.005)
- Use "Refactor" when you need fresh insights ($0.15)

## Common Questions

**Q: Can I create multiple timelines?**
A: Yes! Click "New Timeline" in the top-right to start fresh. Your previous timelines are saved.

**Q: What if I'm not sure about my goal?**
A: That's okay! Start with a general goal like "Work in software" - the AI will help you narrow it down through conversation.

**Q: How accurate is the research?**
A: Research is powered by Parallel AI, which searches current information. However, always verify critical details (deadlines, requirements, costs) from official sources.

**Q: Can I edit the timeline manually?**
A: Yes! Click any block to edit its title, duration, or notes. You can also use the chat to request changes.

**Q: What if the timeline seems unrealistic?**
A: Use the chat to say "This seems too ambitious" or "Can you make this more realistic?" The AI will adjust.

**Q: Does this work offline?**
A: No, you need an internet connection for AI features and research. However, you can export your timeline and work with it offline.

## Troubleshooting

**App won't load:**
- Make sure both backend and frontend servers are running
- Check terminal for error messages
- Try refreshing your browser (http://localhost:3000)

**Timeline generation fails:**
- Check if backend server is running (should show "Server ready")
- Look for error messages in the terminal
- Try creating a new timeline with simpler inputs

**Research not working:**
- Check WebSocket connection (green indicator in browser console)
- Verify Parallel API key is configured correctly
- Check backend logs for authentication errors

**Chat not responding:**
- Make sure you clicked "Show Chat" button
- Check backend server logs for errors
- Try refreshing the page

## Getting Help

**GitHub Issues**: https://github.com/anthropics/claude-code/issues
**Project Documentation**: See `CLAUDE.md` for technical details
**Architecture Reference**: See `CURRENT_AGENT_ARCHITECTURE.md` for system design

## Next Steps

Once you've created your first timeline:

1. **Explore different scenarios**: Create multiple timelines to compare paths
2. **Research deeply**: Click "Refactor" to get comprehensive analysis
3. **Share with mentors**: Export your timeline and discuss with advisors
4. **Track progress**: Update your timeline as you complete milestones

---

**Remember**: This is YOUR career journey. The AI is here to help you think clearly and plan effectively, but you make the final decisions. Use this tool as a thinking partner, not a prescription.

Good luck on your career trajectory!
