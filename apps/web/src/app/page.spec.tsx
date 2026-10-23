import { Paginated, ParticipantView } from '@org/contracts';
import { api } from '@/entities/participant/api';
import HomePage from './page';

jest.mock('@/entities/participant/api', () => ({
  __esModule: true,
  api: { list: jest.fn() },
}));
const mockApi = api as unknown as { list: jest.Mock };

const onePage: Paginated<ParticipantView> = {
  data: [],
  pageInfo: { page: 1, pageSize: 25, total: 0, totalPages: 1 },
};

/** Unit-test the Server Component by calling it as a function and inspecting the
 * element it returns - the SSR seed + fallback is the point of the route. */
describe('HomePage (server component)', () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => errorSpy.mockRestore());

  it('seeds the widget with the server-fetched first page', async () => {
    mockApi.list.mockResolvedValue(onePage);
    const element = await HomePage();
    const props = element.props as {
      initialData: Paginated<ParticipantView> | null;
    };
    expect(props.initialData).toEqual(onePage);
  });

  it('falls back to null (and reports) when the SSR fetch fails', async () => {
    mockApi.list.mockRejectedValue(new Error('api down'));
    const element = await HomePage();
    const props = element.props as {
      initialData: Paginated<ParticipantView> | null;
    };
    expect(props.initialData).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });
});
