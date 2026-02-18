// Run with: node canvas-assignments.js

const CANVAS_URL = 'https://byui.instructure.com';
const API_TOKEN = '10706~wJe73RRZxNP9WGEmweLfrMv2NftfBhZyGX82XHKELMmmD9w9efEJNWwyDE4c4tHQ'; // <-- Replace with your actual API token
//const API_TOKEN = import.meta.env.API_KEY
async function getWeeklyAssignments() {
  try {
    // Get today and 7 days from now
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    console.log(`\nFetching assignments due between ${today.toDateString()} and ${nextWeek.toDateString()}...\n`);

    // Get all active courses
    const coursesRes = await fetch(`${CANVAS_URL}/api/v1/courses?enrollment_state=active`, {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    });
    const courses = await coursesRes.json();

    // Collect all assignments
    const weeklyAssignments = [];

    for (const course of courses) {
      const assignRes = await fetch(`${CANVAS_URL}/api/v1/courses/${course.id}/assignments`, {
        headers: { 'Authorization': `Bearer ${API_TOKEN}` }
      });
      const assignments = await assignRes.json();

      // Filter for assignments due this week
      for (const assignment of assignments) {
        if (assignment.due_at) {
          const dueDate = new Date(assignment.due_at);
          if (dueDate >= today && dueDate <= nextWeek) {
            weeklyAssignments.push({
              course: course.name,
              name: assignment.name,
              due: dueDate,
              points: assignment.points_possible,
              link: assignment.html_url
            });
          }
        }
      }
    }

    // Sort by due date
    weeklyAssignments.sort((a, b) => a.due - b.due);

    // Display results
    console.log('='.repeat(70));
    console.log(`THIS WEEK'S ASSIGNMENTS (${weeklyAssignments.length} total)`);
    console.log('='.repeat(70) + '\n');

    if (weeklyAssignments.length === 0) {
      console.log('No assignments due this week! 🎉\n');
    } else {
      weeklyAssignments.forEach((a, i) => {
        console.log(`${i + 1}. ${a.name}`);
        console.log(`   Course: ${a.course}`);
        console.log(`   Due: ${a.due.toLocaleString()}`);
        console.log(`   Points: ${a.points || 'N/A'}`);
        console.log(`   Link: ${a.link}\n`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run it
getWeeklyAssignments();