import type { Meta, StoryObj } from '@storybook/angular';
import { componentWrapperDecorator } from '@storybook/angular';
import {
  AniensSidebarComponent,
  type MainSidebarPanel,
} from '#app/features/main/main-layout/sidebar/aniens-sidebar.component';

const meta: Meta<AniensSidebarComponent> = {
  title: 'Layout/Sidebar',
  component: AniensSidebarComponent,
  tags: ['autodocs'],
  args: {
    activePanel: 'timeline' as MainSidebarPanel,
  },
  decorators: [
    componentWrapperDecorator(
      (story) => `
        <div style="width: 92px; height: 360px;">
          ${story}
        </div>
      `,
    ),
  ],
};

export default meta;

type Story = StoryObj<AniensSidebarComponent>;

export const TimelineSelected: Story = {
  args: {
    activePanel: 'timeline',
  },
};

export const TaskSelected: Story = {
  args: {
    activePanel: 'task',
  },
};
