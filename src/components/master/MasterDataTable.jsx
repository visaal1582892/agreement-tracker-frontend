import DataTable from '../ui/DataTable';

/** Master pages share horizontal scroll + sticky tail columns. */
export default function MasterDataTable(props) {
  return <DataTable horizontalScroll {...props} />;
}
